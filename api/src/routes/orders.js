
const router = require('express').Router();
const mongoose = require('mongoose');

const auth = require('../middleware/auth');
const Product = require('../models/Product');
const Order = require('../models/Order');

function erroHTTP(status, mensagem) {
    return Object.assign(new Error(mensagem), { status });
}

// ========================================
// POST /api/orders
// Criar encomenda - comprador
// ========================================

router.post('/', auth('comprador'), async (req, res, next) => {
    const { linhas, entrega } = req.body || {};

    if (!Array.isArray(linhas) || linhas.length === 0) {
        return res.status(400).json({
            erro: 'A encomenda deve ter produtos'
        });
    }

    if (
        !entrega ||
        !['levantamento', 'entrega'].includes(entrega.tipo)
    ) {
        return res.status(400).json({
            erro: 'Escolhe levantamento ou entrega'
        });
    }

    if (
        entrega.tipo === 'entrega' &&
        (
            typeof entrega.morada !== 'string' ||
            !entrega.morada.trim()
        )
    ) {
        return res.status(400).json({
            erro: 'A morada é obrigatória para entrega'
        });
    }

    const ids = new Set();

    for (const linha of linhas) {
        if (
            !mongoose.isValidObjectId(linha?.produto) ||
            !Number.isSafeInteger(linha?.quantidade) ||
            linha.quantidade < 1 ||
            ids.has(String(linha.produto))
        ) {
            return res.status(400).json({
                erro: 'Produtos ou quantidades inválidos'
            });
        }

        ids.add(String(linha.produto));
    }

    const session = await mongoose.startSession();

    try {
        let encomenda;

        await session.withTransaction(async () => {
            const produtos = await Product.find({
                _id: { $in: [...ids] }
            }).session(session);

            if (produtos.length !== ids.size) {
                throw erroHTTP(404, 'Produto não encontrado');
            }

            const produtorId = String(produtos[0].produtor);

            if (
                produtos.some(
                    (p) => String(p.produtor) !== produtorId
                )
            ) {
                throw erroHTTP(
                    400,
                    'Cada encomenda deve pertencer a um único produtor'
                );
            }

            const linhasEncomenda = [];

            for (const linha of linhas) {
                const produto = produtos.find(
                    (p) => String(p._id) === String(linha.produto)
                );

                const atualizado = await Product.findOneAndUpdate(
                    {
                        _id: produto._id,
                        stock: { $gte: linha.quantidade }
                    },
                    {
                        $inc: { stock: -linha.quantidade }
                    },
                    {
                        new: true,
                        session
                    }
                );

                if (!atualizado) {
                    throw erroHTTP(
                        409,
                        `Stock insuficiente para ${produto.nome}`
                    );
                }

                linhasEncomenda.push({
                    produto: produto._id,
                    nome: produto.nome,
                    precoUnit: produto.preco,
                    quantidade: linha.quantidade
                });
            }

            const criadas = await Order.create(
                [{
                    comprador: req.user.id,
                    produtor: produtorId,
                    linhas: linhasEncomenda,
                    estado: 'pendente',
                    entrega: {
                        tipo: entrega.tipo,
                        morada:
                            entrega.tipo === 'entrega'
                                ? entrega.morada.trim()
                                : ''
                    }
                }],
                { session }
            );

            encomenda = criadas[0];
        });

        return res
            .status(201)
            .location(`/api/orders/${encomenda._id}`)
            .json(encomenda);

    } catch (err) {
        next(err);
    } finally {
        await session.endSession();
    }
});

// ========================================
// GET /api/orders
// Listar encomendas do utilizador
// ========================================

router.get('/', auth(), async (req, res, next) => {
    try {
        const filtro =
            req.user.papel === 'comprador'
                ? { comprador: req.user.id }
                : req.user.papel === 'produtor'
                    ? { produtor: req.user.id }
                    : {};

        const encomendas = await Order.find(filtro)
            .populate(
                'produtor',
                'nome produtor.nomeExploracao'
            )
            .populate('comprador', 'nome')
            .sort({ createdAt: -1 });

        return res.status(200).json(encomendas);

    } catch (err) {
        next(err);
    }
});

// ========================================
// GET /api/orders/:id
// NOVO - Consultar detalhe de encomenda
// ========================================

router.get('/:id', auth(), async (req, res, next) => {
    try {
        const { id } = req.params;

        // 1. Validar o ID recebido
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                erro: 'Identificador da encomenda inválido'
            });
        }

        // 2. Aplicar permissões por papel
        const filtro = { _id: id };

        if (req.user.papel === 'comprador') {
            filtro.comprador = req.user.id;
        } else if (req.user.papel === 'produtor') {
            filtro.produtor = req.user.id;
        } else if (req.user.papel !== 'admin') {
            return res.status(403).json({
                erro: 'Sem permissão'
            });
        }

        // 3. Consultar a encomenda
        const encomenda = await Order.findOne(filtro)
            .populate('comprador', 'nome')
            .populate(
                'produtor',
                'nome produtor.nomeExploracao'
            )
            .populate(
                'linhas.produto',
                'nome imagemUrl unidade'
            )
            .lean();

        // 4. Se não existir ou não pertencer
        // ao utilizador, não revelar os dados
        if (!encomenda) {
            return res.status(404).json({
                erro: 'Encomenda não encontrada'
            });
        }

        // 5. Enviar detalhe completo
        return res.status(200).json(encomenda);

    } catch (err) {
        next(err);
    }
});

// ========================================
// PATCH /api/orders/:id/estado
// Atualizar estado - produtor
// ========================================

router.patch(
    '/:id/estado',
    auth('produtor'),
    async (req, res, next) => {
        try {
            const { estado } = req.body || {};

            const estadoAnterior = {
                confirmada: 'pendente',
                pronta: 'confirmada',
                entregue: 'pronta'
            };

            if (
                !Object.prototype.hasOwnProperty.call(
                    estadoAnterior,
                    estado
                )
            ) {
                return res.status(400).json({
                    erro: 'Estado de encomenda inválido'
                });
            }

            if (!mongoose.isValidObjectId(req.params.id)) {
                return res.status(400).json({
                    erro: 'Identificador inválido'
                });
            }

            const encomenda = await Order.findOneAndUpdate(
                {
                    _id: req.params.id,
                    produtor: req.user.id,
                    estado: estadoAnterior[estado]
                },
                {
                    $set: { estado }
                },
                {
                    new: true,
                    runValidators: true
                }
            );

            if (!encomenda) {
                return res.status(404).json({
                    erro:
                        'Encomenda não encontrada ou transição inválida'
                });
            }

            // Notificar o comprador em tempo real
            const io = req.app.get('io');

            if (io) {
                io.to(
                    `user:${encomenda.comprador.toString()}`
                ).emit('encomenda-atualizada', {
                    encomendaId: encomenda._id.toString(),
                    estado: encomenda.estado
                });
            }

            return res.status(200).json(encomenda);

        } catch (err) {
            next(err);
        }
    }
);

module.exports = router;
