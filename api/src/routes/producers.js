
const router = require('express').Router();
const mongoose = require('mongoose');

const User = require('../models/User');
const Product = require('../models/Product');
const Review = require('../models/Review');

// Campos permitidos no perfil público.
// Nunca devolver passwords, tokens ou emails privados.
const CAMPOS_PUBLICOS = [
    'nome',
    'produtor.nomeExploracao',
    'produtor.descricao',
    'produtor.localidade',
    'produtor.concelho',
    'produtor.morada',
    'produtor.localizacao'
].join(' ');

// Calcular as avaliações públicas dos produtores.
// Só considera avaliações do tipo "produtor".
async function obterEstatisticas(produtorIds) {
    if (!produtorIds.length) {
        return new Map();
    }

    const resultados = await Review.aggregate([
        {
            $match: {
                produtor: { $in: produtorIds },
                tipo: 'produtor',
                visivel: true
            }
        },
        {
            $group: {
                _id: '$produtor',
                avaliacaoMedia: {
                    $avg: '$classificacao'
                },
                totalAvaliacoes: {
                    $sum: 1
                }
            }
        }
    ]);

    return new Map(
        resultados.map((item) => [
            String(item._id),
            {
                avaliacaoMedia: Number(
                    item.avaliacaoMedia.toFixed(1)
                ),
                totalAvaliacoes: item.totalAvaliacoes
            }
        ])
    );
}

// ========================================
// GET /api/producers
// Listar produtores validados
// ========================================

router.get('/', async (req, res, next) => {
    try {
        const filtro = {
            papel: 'produtor',
            'produtor.validado': true
        };

        const { localidade } = req.query;

        if (localidade !== undefined) {
            if (
                typeof localidade !== 'string' ||
                localidade.trim().length > 100
            ) {
                return res.status(400).json({
                    erro: 'Localidade inválida'
                });
            }

            const texto = localidade.trim();

            if (texto) {
                // Evitar interpretar caracteres especiais
                // introduzidos pelo utilizador como regex.
                const seguro = texto.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    '\\$&'
                );

                filtro['produtor.localidade'] = {
                    $regex: seguro,
                    $options: 'i'
                };
            }
        }

        const produtores = await User.find(filtro)
            .select(CAMPOS_PUBLICOS)
            .sort({
                'produtor.nomeExploracao': 1
            })
            .limit(100)
            .lean();

        const estatisticas = await obterEstatisticas(
            produtores.map((p) => p._id)
        );

        const resposta = produtores.map((p) => {
            const dados = estatisticas.get(
                String(p._id)
            );

            return {
                ...p,
                avaliacaoMedia:
                    dados?.avaliacaoMedia ?? null,
                totalAvaliacoes:
                    dados?.totalAvaliacoes ?? 0
            };
        });

        return res.status(200).json(resposta);

    } catch (err) {
        next(err);
    }
});

// ========================================
// GET /api/producers/:id
// Perfil público do produtor
// ========================================

router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        // Validar identificador
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                erro: 'Identificador de produtor inválido'
            });
        }

        // Obter apenas produtores aprovados
        const produtor = await User.findOne({
            _id: id,
            papel: 'produtor',
            'produtor.validado': true
        })
            .select(CAMPOS_PUBLICOS)
            .lean();

        if (!produtor) {
            return res.status(404).json({
                erro: 'Produtor não encontrado ou não aprovado'
            });
        }

        // Produtos disponíveis deste produtor
        const produtos = await Product.find({
            produtor: produtor._id,
            stock: { $gt: 0 },
            ativo: { $ne: false }
        })
            .select(
                'nome descricao categoria preco unidade ' +
                'stock biologico epocas imagens imagemUrl produtor'
            )
            .sort({ nome: 1 })
            .lean();

        // Classificação média do produtor
        const estatisticas = await obterEstatisticas([
            produtor._id
        ]);

        const dados = estatisticas.get(
            String(produtor._id)
        );

        // Resposta pública
        return res.status(200).json({
            produtor,
            produtos,
            avaliacaoMedia:
                dados?.avaliacaoMedia ?? null,
            totalAvaliacoes:
                dados?.totalAvaliacoes ?? 0
        });

    } catch (err) {
        next(err);
    }
});

module.exports = router;
