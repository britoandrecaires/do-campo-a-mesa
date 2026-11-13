
const router = require('express').Router();
const mongoose = require('mongoose');

const auth = require('../middleware/auth');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const User = require('../models/User');

// ========================================
// FUNÇÃO AUXILIAR
// Histórico público de licitações
// ========================================

async function obterHistorico(leilaoId, limite = 20) {
    const licitacoes = await Bid.find({
        leilao: leilaoId
    })
        .sort({ createdAt: -1 })
        .limit(limite)
        .populate('comprador', 'nome')
        .lean();

    return licitacoes.map((bid) => ({
        _id: String(bid._id),
        valor: bid.valor,
        nome: bid.comprador?.nome || 'Comprador',
        createdAt: bid.createdAt
    }));
}

// ========================================
// GET /api/auctions
// Listar leilões
// ========================================

router.get('/', async (req, res, next) => {
    try {
        const { estado } = req.query;

        const estadosValidos = [
            'agendado',
            'ativo',
            'terminado'
        ];

        if (
            estado &&
            !estadosValidos.includes(estado)
        ) {
            return res.status(400).json({
                erro: 'Estado de leilão inválido'
            });
        }

        const filtro = estado
            ? { estado }
            : {};

        const leiloes = await Auction.find(filtro)
            .populate(
                'produtor',
                'nome produtor.nomeExploracao'
            )
            .sort({ terminaEm: 1 });

        return res.status(200).json(leiloes);

    } catch (err) {
        next(err);
    }
});

// ========================================
// GET /api/auctions/:id/bids
// NOVO - Histórico de licitações
// ========================================

router.get('/:id/bids', async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                erro: 'Identificador do leilão inválido'
            });
        }

        // Confirmar que o leilão existe
        const existe = await Auction.exists({
            _id: id
        });

        if (!existe) {
            return res.status(404).json({
                erro: 'Leilão não encontrado'
            });
        }

        // Obter as 100 licitações mais recentes
        const historico = await obterHistorico(id, 100);

        return res.status(200).json(historico);

    } catch (err) {
        next(err);
    }
});

// ========================================
// GET /api/auctions/:id
// NOVO - Detalhe de um leilão
// ========================================

router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                erro: 'Identificador do leilão inválido'
            });
        }

        // Consultar o leilão
        const leilao = await Auction.findById(id)
            .populate(
                'produtor',
                'nome produtor.nomeExploracao'
            )
            .populate(
                'produto',
                'nome imagemUrl unidade'
            )
            .populate(
                'licitacaoAtual.comprador',
                'nome'
            )
            .lean();

        if (!leilao) {
            return res.status(404).json({
                erro: 'Leilão não encontrado'
            });
        }

        // Obter as últimas 20 licitações
        const licitacoes = await obterHistorico(id, 20);

        return res.status(200).json({
            leilao,
            licitacoes
        });

    } catch (err) {
        next(err);
    }
});

// ========================================
// POST /api/auctions
// Criar leilão - produtor aprovado
// ========================================

router.post(
    '/',
    auth('produtor'),
    async (req, res, next) => {
        try {
            const {
                lote,
                descricao = '',
                quantidade = '',
                precoBase,
                incremento,
                iniciaEm,
                terminaEm
            } = req.body || {};

            const base = Number(precoBase);
            const minimo = Number(incremento);
            const inicio = new Date(iniciaEm);
            const fim = new Date(terminaEm);
            const agora = new Date();

            if (
                typeof lote !== 'string' ||
                !lote.trim()
            ) {
                return res.status(400).json({
                    erro: 'O nome do lote é obrigatório'
                });
            }

            if (
                !Number.isFinite(base) ||
                base <= 0 ||
                !Number.isFinite(minimo) ||
                minimo <= 0
            ) {
                return res.status(400).json({
                    erro: 'Preço base e incremento devem ser positivos'
                });
            }

            if (
                isNaN(inicio.getTime()) ||
                isNaN(fim.getTime()) ||
                fim <= inicio ||
                fim <= agora
            ) {
                return res.status(400).json({
                    erro: 'Datas do leilão inválidas'
                });
            }

            // Verificar aprovação do produtor
            const utilizador = await User.findById(
                req.user.id
            );

            if (!utilizador?.produtor?.validado) {
                return res.status(403).json({
                    erro: 'O produtor ainda não foi aprovado'
                });
            }

            // Criar o leilão
            const leilao = await Auction.create({
                produtor: req.user.id,
                lote: lote.trim(),
                descricao,
                quantidade,
                precoBase: base,
                incremento: minimo,
                licitacaoAtual: {
                    valor: base
                },
                numLicitacoes: 0,
                iniciaEm: inicio,
                terminaEm: fim,
                estado:
                    inicio <= agora
                        ? 'ativo'
                        : 'agendado'
            });

            return res
                .status(201)
                .location(`/api/auctions/${leilao._id}`)
                .json(leilao);

        } catch (err) {
            next(err);
        }
    }
);

module.exports = router;
