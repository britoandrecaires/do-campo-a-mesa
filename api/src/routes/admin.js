
const router = require('express').Router();
const mongoose = require('mongoose');

const auth = require('../middleware/auth');

const User = require('../models/User');
const Order = require('../models/Order');
const Auction = require('../models/Auction');
const Review = require('../models/Review');

// Todas as rotas exigem administrador
router.use(auth('admin'));

// ========================================
// GET /api/admin/estatisticas
// Estatísticas gerais da plataforma
// ========================================

router.get('/estatisticas', async (req, res, next) => {
    try {
        const agora = new Date();

        const inicioDia = new Date();
        inicioDia.setHours(0, 0, 0, 0);

        const [
            utilizadores,
            produtores,
            encomendasHoje,
            leiloesAtivos
        ] = await Promise.all([
            User.countDocuments(),

            User.countDocuments({
                papel: 'produtor'
            }),

            Order.countDocuments({
                createdAt: { $gte: inicioDia }
            }),

            Auction.countDocuments({
                estado: 'ativo',
                terminaEm: { $gt: agora }
            })
        ]);

        return res.json({
            utilizadores,
            produtores,
            encomendasHoje,
            leiloesAtivos
        });

    } catch (err) {
        next(err);
    }
});

// ========================================
// GET /api/admin/produtores/pendentes
// Produtores que aguardam validação
// ========================================

router.get('/produtores/pendentes', async (req, res, next) => {
    try {
        const produtores = await User.find({
            papel: 'produtor',
            'produtor.validado': false,
            'produtor.estadoValidacao': {
                $ne: 'rejeitado'
            }
        })
            .select('nome email produtor createdAt')
            .sort({ createdAt: -1 });

        return res.json(produtores);

    } catch (err) {
        next(err);
    }
});

// ========================================
// PATCH /api/admin/produtores/:id/validacao
// Aprovar ou rejeitar um produtor
// ========================================

router.patch(
    '/produtores/:id/validacao',
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const { aprovado } = req.body || {};

            if (!mongoose.isValidObjectId(id)) {
                return res.status(400).json({
                    erro: 'Identificador do produtor inválido'
                });
            }

            if (typeof aprovado !== 'boolean') {
                return res.status(400).json({
                    erro: 'O campo aprovado deve ser true ou false'
                });
            }

            const produtor = await User.findOneAndUpdate(
                {
                    _id: id,
                    papel: 'produtor',
                    'produtor.validado': false,
                    'produtor.estadoValidacao': {
                        $ne: 'rejeitado'
                    }
                },
                {
                    $set: {
                        'produtor.validado': aprovado,
                        'produtor.estadoValidacao': aprovado
                            ? 'aprovado'
                            : 'rejeitado'
                    }
                },
                {
                    new: true,
                    runValidators: true
                }
            ).select('nome email produtor');

            if (!produtor) {
                return res.status(404).json({
                    erro: 'Produtor pendente não encontrado'
                });
            }

            return res.json(produtor);

        } catch (err) {
            next(err);
        }
    }
);

// ========================================
// GET /api/admin/reviews/denunciadas
// Consultar avaliações por moderar
// ========================================

router.get(
    '/reviews/denunciadas',
    async (req, res, next) => {
        try {
            // Apenas avaliações públicas
            // com pelo menos uma denúncia
            const avaliacoes = await Review.find({
                visivel: true,
                denuncias: { $gt: 0 }
            })
                .select(
                    'autor produtor produto tipo ' +
                    'classificacao comentario ' +
                    'denuncias visivel createdAt'
                )
                .populate('autor', 'nome')
                .populate(
                    'produtor',
                    'nome produtor.nomeExploracao'
                )
                .populate('produto', 'nome')
                .sort({
                    denuncias: -1,
                    createdAt: -1
                })
                .limit(100)
                .lean();

            return res.status(200).json(avaliacoes);

        } catch (err) {
            next(err);
        }
    }
);

// ========================================
// PATCH /api/admin/reviews/:id
// Moderar uma avaliação denunciada
// ========================================

router.patch(
    '/reviews/:id',
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const { visivel } = req.body || {};

            // Validar identificador
            if (!mongoose.isValidObjectId(id)) {
                return res.status(400).json({
                    erro: 'Identificador da avaliação inválido'
                });
            }

            // Apenas aceitar valores booleanos
            if (typeof visivel !== 'boolean') {
                return res.status(400).json({
                    erro: 'O campo visivel deve ser true ou false'
                });
            }

            /*
             * visivel = false:
             * Ocultar avaliação denunciada.
             *
             * visivel = true:
             * Manter pública e limpar denúncias
             * já analisadas pelo administrador.
             */

            const alteracoes = visivel
                ? {
                    visivel: true,
                    denuncias: 0
                }
                : {
                    visivel: false
                };

            // Atualizar apenas avaliações
            // que ainda aguardam moderação
            const avaliacao = await Review.findOneAndUpdate(
                {
                    _id: id,
                    visivel: true,
                    denuncias: { $gt: 0 }
                },
                {
                    $set: alteracoes
                },
                {
                    new: true,
                    runValidators: true
                }
            )
                .populate('autor', 'nome')
                .populate(
                    'produtor',
                    'nome produtor.nomeExploracao'
                )
                .populate('produto', 'nome');

            if (!avaliacao) {
                return res.status(404).json({
                    erro: 'Avaliação denunciada não encontrada ou já moderada'
                });
            }

            return res.status(200).json({
                mensagem: visivel
                    ? 'Avaliação mantida pública. Denúncias resolvidas.'
                    : 'Avaliação ocultada com sucesso.',
                avaliacao
            });

        } catch (err) {
            next(err);
        }
    }
);

module.exports = router;
