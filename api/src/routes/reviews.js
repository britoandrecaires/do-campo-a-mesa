
const router = require('express').Router();
const mongoose = require('mongoose');

const auth = require('../middleware/auth');
const Review = require('../models/Review');
const Order = require('../models/Order');

// ========================================
// POST /api/reviews
// Criar avaliação de produto ou produtor
// ========================================

router.post('/', auth('comprador'), async (req, res, next) => {
    try {
        const {
            encomenda,
            produto,
            tipo,
            classificacao,
            comentario
        } = req.body || {};

        // Validar a encomenda
        if (!mongoose.isValidObjectId(encomenda)) {
            return res.status(400).json({
                erro: 'Identificador de encomenda inválido'
            });
        }

        // Validar tipo de avaliação
        if (!['produto', 'produtor'].includes(tipo)) {
            return res.status(400).json({
                erro: 'Escolhe avaliar um produto ou produtor'
            });
        }

        // Validar classificação
        const nota = Number(classificacao);

        if (
            !['number', 'string'].includes(typeof classificacao) ||
            !Number.isInteger(nota) ||
            nota < 1 ||
            nota > 5
        ) {
            return res.status(400).json({
                erro: 'A classificação deve ser de 1 a 5 estrelas'
            });
        }

        // Validar comentário
        if (
            comentario != null &&
            (
                typeof comentario !== 'string' ||
                comentario.trim().length > 1000
            )
        ) {
            return res.status(400).json({
                erro: 'O comentário deve ter até 1000 caracteres'
            });
        }

        // Confirmar que a encomenda pertence
        // ao comprador e já foi entregue
        const pedido = await Order.findOne({
            _id: encomenda,
            comprador: req.user.id,
            estado: 'entregue'
        });

        if (!pedido) {
            return res.status(403).json({
                erro: 'Só podes avaliar encomendas tuas que já foram entregues'
            });
        }

        let produtoId = null;

        // Avaliação de produto
        if (tipo === 'produto') {
            if (!mongoose.isValidObjectId(produto)) {
                return res.status(400).json({
                    erro: 'Seleciona um produto válido'
                });
            }

            // Verificar se o produto pertence à encomenda
            const pertence = pedido.linhas.some(
                (linha) =>
                    linha.produto &&
                    String(linha.produto) === String(produto)
            );

            if (!pertence) {
                return res.status(403).json({
                    erro: 'Este produto não pertence à encomenda'
                });
            }

            produtoId = produto;
        }

        // Avaliação do produtor
        if (
            tipo === 'produtor' &&
            produto != null &&
            produto !== ''
        ) {
            return res.status(400).json({
                erro: 'Uma avaliação de produtor não deve indicar produto'
            });
        }

        // Criar avaliação
        const avaliacao = await Review.create({
            autor: req.user.id,
            produtor: pedido.produtor,
            produto: produtoId,
            encomenda: pedido._id,
            tipo,
            classificacao: nota,
            comentario: comentario?.trim() || '',
            denuncias: 0,
            denunciantes: [],
            visivel: true
        });

        const resultado = await Review.findById(
            avaliacao._id
        )
            .populate('autor', 'nome')
            .populate(
                'produtor',
                'nome produtor.nomeExploracao'
            )
            .populate('produto', 'nome');

        return res.status(201).json(resultado);

    } catch (err) {
        // Índice único: impedir avaliações duplicadas
        if (err.code === 11000) {
            return res.status(409).json({
                erro: 'Já avaliaste este item nesta encomenda'
            });
        }

        next(err);
    }
});

// ========================================
// GET /api/reviews
// Listar avaliações públicas
// ========================================

router.get('/', async (req, res, next) => {
    try {
        const { produtor, produto } = req.query;

        const filtro = {
            visivel: true
        };

        // Filtrar por produtor
        if (produtor !== undefined) {
            if (!mongoose.isValidObjectId(produtor)) {
                return res.status(400).json({
                    erro: 'Identificador de produtor inválido'
                });
            }

            filtro.produtor = produtor;
        }

        // Filtrar por produto
        if (produto !== undefined) {
            if (!mongoose.isValidObjectId(produto)) {
                return res.status(400).json({
                    erro: 'Identificador de produto inválido'
                });
            }

            filtro.produto = produto;
            filtro.tipo = 'produto';
        }

        const avaliacoes = await Review.find(filtro)
            .populate('autor', 'nome')
            .populate(
                'produtor',
                'nome produtor.nomeExploracao'
            )
            .populate('produto', 'nome')
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        return res.json(avaliacoes);

    } catch (err) {
        next(err);
    }
});

// ========================================
// POST /api/reviews/:id/denuncia
// Denunciar uma avaliação
// ========================================

router.post(
    '/:id/denuncia',
    auth(),
    async (req, res, next) => {
        try {
            const { id } = req.params;

            // 1. Validar identificador da avaliação
            if (!mongoose.isValidObjectId(id)) {
                return res.status(400).json({
                    erro: 'Identificador da avaliação inválido'
                });
            }

            // O identificador vem do token autenticado
            if (!mongoose.isValidObjectId(req.user.id)) {
                return res.status(401).json({
                    erro: 'Utilizador inválido'
                });
            }

            const utilizadorId = new mongoose.Types.ObjectId(
                req.user.id
            );

            // 2. Registar a denúncia atomicamente
            const resultado = await Review.updateOne(
                {
                    _id: id,
                    visivel: true,

                    // Não permitir denunciar a própria avaliação
                    autor: {
                        $ne: utilizadorId
                    },

                    // Não permitir denunciar duas vezes
                    denunciantes: {
                        $ne: utilizadorId
                    }
                },
                {
                    // Guardar identificador do denunciante
                    $addToSet: {
                        denunciantes: utilizadorId
                    },

                    // Aumentar contador apenas se a
                    // denúncia for realmente aceite
                    $inc: {
                        denuncias: 1
                    }
                }
            );

            // 3. Denúncia aceite
            if (resultado.modifiedCount === 1) {
                return res.status(204).send();
            }

            // 4. Descobrir o motivo da recusa
            const avaliacao = await Review.findById(id)
                .select('autor visivel +denunciantes')
                .lean();

            if (!avaliacao || !avaliacao.visivel) {
                return res.status(404).json({
                    erro: 'Avaliação não encontrada ou indisponível'
                });
            }

            // O autor não pode denunciar a própria avaliação
            if (
                String(avaliacao.autor) === String(utilizadorId)
            ) {
                return res.status(403).json({
                    erro: 'Não podes denunciar a tua própria avaliação'
                });
            }

            // O utilizador já denunciou anteriormente
            const jaDenunciou = (
                avaliacao.denunciantes || []
            ).some(
                (denunciante) =>
                    String(denunciante) === String(utilizadorId)
            );

            if (jaDenunciou) {
                return res.status(409).json({
                    erro: 'Já denunciaste esta avaliação'
                });
            }

            return res.status(409).json({
                erro: 'A denúncia não pôde ser registada. Tenta novamente.'
            });

        } catch (err) {
            next(err);
        }
    }
);

module.exports = router;
