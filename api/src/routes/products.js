
const router = require('express').Router();
const mongoose = require('mongoose');
const multer = require('multer');

const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');

const auth = require('../middleware/auth');
const { guardarImagem } = require('../services/imagens');

// ========================================
// CONFIGURAÇÕES
// ========================================

// Fotografias até 5 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  }
});

// Stock igual ou inferior a 10 gera um alerta
const LIMITE_STOCK_BAIXO = 10;

const CATEGORIAS = [
  'Hortícolas',
  'Fruta',
  'Mel',
  'Vinho',
  'Queijo',
  'Padaria',
  'Outros'
];

const EPOCAS = [
  'Primavera',
  'Verão',
  'Outono',
  'Inverno'
];

const CAMPOS_EDITAVEIS = [
  'nome',
  'categoria',
  'preco',
  'unidade',
  'stock',
  'biologico',
  'epocas'
];

// ========================================
// GET /api/products
// CATÁLOGO PÚBLICO COM FILTROS
// ========================================

router.get('/', async (req, res, next) => {
  try {
    const {
      q,
      categoria,
      precoMax,
      bio,
      epoca,
      produtor,
      ordenacao
    } = req.query;

    const filtro = {};

    // ------------------------------------
    // 1. PESQUISA PELO NOME
    // ------------------------------------

    if (q !== undefined && q !== '') {
      if (
        typeof q !== 'string' ||
        q.length > 100
      ) {
        return res.status(400).json({
          erro: 'Pesquisa inválida'
        });
      }

      // Impedir que a pesquisa execute
      // expressões regulares introduzidas
      // pelo utilizador
      const pesquisaSegura = q.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );

      filtro.nome = {
        $regex: pesquisaSegura,
        $options: 'i'
      };
    }

    // ------------------------------------
    // 2. FILTRAR POR CATEGORIA
    // ------------------------------------

    if (categoria && categoria !== 'Todos') {
      if (!CATEGORIAS.includes(categoria)) {
        return res.status(400).json({
          erro: 'Categoria inválida'
        });
      }

      filtro.categoria = categoria;
    }

    // ------------------------------------
    // 3. FILTRAR POR PREÇO MÁXIMO
    // ------------------------------------

    if (
      precoMax !== undefined &&
      precoMax !== ''
    ) {
      const preco = Number(precoMax);

      if (
        typeof precoMax !== 'string' ||
        !precoMax.trim() ||
        !Number.isFinite(preco) ||
        preco < 0
      ) {
        return res.status(400).json({
          erro: 'Preço máximo inválido'
        });
      }

      filtro.preco = {
        $lte: preco
      };
    }

    // ------------------------------------
    // 4. FILTRAR PRODUTOS BIOLÓGICOS
    // ------------------------------------

    if (bio === 'true') {
      filtro.biologico = true;
    }

    // ------------------------------------
    // 5. FILTRAR POR ÉPOCA
    // ------------------------------------

    if (epoca) {
      if (!EPOCAS.includes(epoca)) {
        return res.status(400).json({
          erro: 'Época inválida'
        });
      }

      // Mongoose procura o valor
      // dentro do array epocas
      filtro.epocas = epoca;
    }

    // ------------------------------------
    // 6. FILTRAR POR PRODUTOR
    // ------------------------------------

    if (produtor) {
      if (!mongoose.isValidObjectId(produtor)) {
        return res.status(400).json({
          erro: 'Identificador de produtor inválido'
        });
      }

      filtro.produtor = produtor;
    }

    // ------------------------------------
    // 7. ORDENAÇÃO
    // ------------------------------------

    const ordenacoes = {
      recentes: {
        createdAt: -1
      },
      preco_asc: {
        preco: 1,
        _id: 1
      },
      preco_desc: {
        preco: -1,
        _id: 1
      },
      nome_asc: {
        nome: 1,
        _id: 1
      }
    };

    if (
      ordenacao &&
      !Object.prototype.hasOwnProperty.call(
        ordenacoes,
        ordenacao
      )
    ) {
      return res.status(400).json({
        erro: 'Ordenação inválida'
      });
    }

    // ------------------------------------
    // 8. CONSULTAR MONGODB
    // ------------------------------------

    let consulta = Product.find(filtro);

    if (ordenacao) {
      consulta = consulta.sort(
        ordenacoes[ordenacao]
      );
    }

    const produtos = await consulta.populate(
      'produtor',
      'nome produtor.nomeExploracao produtor.localidade'
    );

    return res.status(200).json(produtos);

  } catch (err) {
    next(err);
  }
});

// ========================================
// GET /api/products/estatisticas
// ESTATÍSTICAS DO PRODUTOR
// ========================================

router.get(
  '/estatisticas',
  auth('produtor'),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.user.id)) {
        return res.status(401).json({
          erro: 'Utilizador inválido'
        });
      }

      const produtorId = new mongoose.Types.ObjectId(
        req.user.id
      );

      // Consultar os indicadores do produtor
      const [
        totalProdutos,
        listaStockBaixo,
        resumoEncomendas,
        resumoVendas
      ] = await Promise.all([

        // Quantos produtos estão registados?
        Product.countDocuments({
          produtor: produtorId
        }),

        // Quais têm stock baixo?
        Product.find({
          produtor: produtorId,
          stock: {
            $lte: LIMITE_STOCK_BAIXO
          }
        })
          .select('nome stock unidade')
          .sort({
            stock: 1,
            nome: 1
          })
          .lean(),

        // Quantas encomendas existem
        // em cada estado?
        Order.aggregate([
          {
            $match: {
              produtor: produtorId
            }
          },
          {
            $group: {
              _id: '$estado',
              total: {
                $sum: 1
              }
            }
          }
        ]),

        // Valor dos produtos de encomendas
        // marcadas como entregues
        Order.aggregate([
          {
            $match: {
              produtor: produtorId,
              estado: 'entregue'
            }
          },
          {
            $unwind: '$linhas'
          },
          {
            $group: {
              _id: null,
              valorTotal: {
                $sum: {
                  $multiply: [
                    '$linhas.precoUnit',
                    '$linhas.quantidade'
                  ]
                }
              }
            }
          }
        ])
      ]);

      // ------------------------------------
      // ORGANIZAR ENCOMENDAS POR ESTADO
      // ------------------------------------

      const encomendasPorEstado = {
        pendente: 0,
        confirmada: 0,
        pronta: 0,
        entregue: 0
      };

      for (const item of resumoEncomendas) {
        if (
          Object.prototype.hasOwnProperty.call(
            encomendasPorEstado,
            item._id
          )
        ) {
          encomendasPorEstado[item._id] =
            item.total;
        }
      }

      // Número total de encomendas
      const totalEncomendas = Object.values(
        encomendasPorEstado
      ).reduce(
        (soma, quantidade) => soma + quantidade,
        0
      );

      // Valor das encomendas entregues
      const valorEncomendasEntregues = Number(
        (
          resumoVendas[0]?.valorTotal || 0
        ).toFixed(2)
      );

      // ------------------------------------
      // RESPOSTA PARA O PAINEL REACT
      // ------------------------------------

      return res.status(200).json({
        totalProdutos,
        totalEncomendas,
        valorEncomendasEntregues,

        produtosStockBaixo: listaStockBaixo.length,
        limiteStockBaixo: LIMITE_STOCK_BAIXO,
        listaStockBaixo,

        encomendasPorEstado
      });

    } catch (err) {
      next(err);
    }
  }
);

// ========================================
// GET /api/products/meus
// PRODUTOS DO PRODUTOR AUTENTICADO
// ========================================

router.get(
  '/meus',
  auth('produtor'),
  async (req, res, next) => {
    try {
      const produtos = await Product.find({
        produtor: req.user.id
      }).sort({
        createdAt: -1
      });

      return res.status(200).json(produtos);

    } catch (err) {
      next(err);
    }
  }
);

// ========================================
// GET /api/products/:id
// DETALHE PÚBLICO DE UM PRODUTO
// ========================================

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validar o identificador
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        erro: 'Identificador do produto inválido'
      });
    }

    // Obter o produto com os dados
    // públicos do respetivo produtor
    const produto = await Product.findById(id)
      .populate(
        'produtor',
        'nome produtor.nomeExploracao ' +
        'produtor.localidade produtor.descricao ' +
        'produtor.localizacao'
      )
      .lean();

    if (!produto) {
      return res.status(404).json({
        erro: 'Produto não encontrado'
      });
    }

    return res.status(200).json(produto);

  } catch (err) {
    next(err);
  }
});

// ========================================
// POST /api/products
// CRIAR UM PRODUTO
// ========================================

router.post(
  '/',
  auth('produtor'),
  async (req, res, next) => {
    try {
      // Verificar se o produtor foi aprovado
      const utilizador = await User.findById(
        req.user.id
      );

      if (!utilizador?.produtor?.validado) {
        return res.status(403).json({
          erro: 'O produtor ainda não foi aprovado'
        });
      }

      // Apenas permitir os campos definidos
      const campos = [
        'nome',
        'categoria',
        'preco',
        'unidade',
        'stock',
        'biologico',
        'epocas'
      ];

      const dados = {};

      for (const campo of campos) {
        if (req.body?.[campo] !== undefined) {
          dados[campo] = req.body[campo];
        }
      }

      // Criar no MongoDB
      const produto = await Product.create({
        ...dados,
        produtor: req.user.id
      });

      return res
        .status(201)
        .location(`/api/products/${produto._id}`)
        .json(produto);

    } catch (err) {
      next(err);
    }
  }
);

// ========================================
// PUT /api/products/:id
// EDITAR UM PRODUTO
// ========================================

router.put(
  '/:id',
  auth('produtor'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          erro: 'Identificador do produto inválido'
        });
      }

      // Construir dados permitidos
      const dados = {};

      for (const campo of CAMPOS_EDITAVEIS) {
        if (req.body?.[campo] !== undefined) {
          dados[campo] = req.body[campo];
        }
      }

      if (Object.keys(dados).length === 0) {
        return res.status(400).json({
          erro: 'Nenhum campo válido para atualizar'
        });
      }

      // Atualizar apenas produtos do
      // produtor autenticado
      const produto = await Product.findOneAndUpdate(
        {
          _id: id,
          produtor: req.user.id
        },
        {
          $set: dados
        },
        {
          new: true,
          runValidators: true
        }
      );

      if (!produto) {
        return res.status(404).json({
          erro: 'Produto não encontrado'
        });
      }

      return res.status(200).json(produto);

    } catch (err) {
      next(err);
    }
  }
);

// ========================================
// DELETE /api/products/:id
// ELIMINAR UM PRODUTO
// ========================================

router.delete(
  '/:id',
  auth('produtor'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          erro: 'Identificador do produto inválido'
        });
      }

      // Eliminar apenas se pertencer
      // ao produtor autenticado
      const resultado = await Product.deleteOne({
        _id: id,
        produtor: req.user.id
      });

      if (resultado.deletedCount === 0) {
        return res.status(404).json({
          erro: 'Produto não encontrado'
        });
      }

      return res.status(204).end();

    } catch (err) {
      next(err);
    }
  }
);

// ========================================
// POST /api/products/:id/imagem
// UPLOAD DA FOTOGRAFIA DO PRODUTO
// ========================================

router.post(
  '/:id/imagem',
  auth('produtor'),
  upload.single('imagem'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // Validar identificador
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          erro: 'Identificador do produto inválido'
        });
      }

      // Verificar aprovação do produtor
      const utilizador = await User.findById(
        req.user.id
      ).select('produtor.validado');

      if (!utilizador?.produtor?.validado) {
        return res.status(403).json({
          erro: 'O produtor ainda não foi aprovado'
        });
      }

      // Verificar se o produto pertence
      // ao produtor autenticado
      const produto = await Product.findOne({
        _id: id,
        produtor: req.user.id
      });

      if (!produto) {
        return res.status(404).json({
          erro: 'Produto não encontrado ou sem autorização'
        });
      }

      // Verificar se a fotografia foi enviada
      if (!req.file) {
        return res.status(400).json({
          erro: 'Seleciona uma imagem para enviar'
        });
      }

      // ------------------------------------
      // VALIDAR E GUARDAR A FOTOGRAFIA
      // ------------------------------------

      let imagemUrl;

      try {
        imagemUrl = await guardarImagem(
          req.file
        );

      } catch (err) {
        const errosValidacao = [
          'Nenhuma imagem foi enviada',
          'A imagem deve ter no máximo 5 MB',
          'Formato inválido. Utiliza JPG, PNG ou WebP'
        ];

        if (errosValidacao.includes(err.message)) {
          return res.status(400).json({
            erro: err.message
          });
        }

        throw err;
      }

      // ------------------------------------
      // GUARDAR URL NO MONGODB
      // ------------------------------------

      const atualizado = await Product.findOneAndUpdate(
        {
          _id: id,
          produtor: req.user.id
        },
        {
          $set: {
            imagemUrl
          }
        },
        {
          new: true,
          runValidators: true
        }
      );

      if (!atualizado) {
        return res.status(404).json({
          erro: 'Produto deixou de estar disponível'
        });
      }

      // Devolver a URL ao React
      return res.status(200).json({
        imagemUrl: atualizado.imagemUrl
      });

    } catch (err) {
      next(err);
    }
  }
);

// ========================================
// TRATAMENTO DE ERROS DO MULTER
// ========================================

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        erro: 'A imagem excede o limite de 5 MB'
      });
    }

    return res.status(400).json({
      erro: 'Erro no envio da imagem. Verifica o ficheiro.'
    });
  }

  next(err);
});

module.exports = router;
