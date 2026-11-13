// Leilões (a parte REST; as licitações em direto são feitas por Socket.io)
const router = require('express').Router();
const auth = require('../middleware/auth');
const Auction = require('../models/Auction');
const User = require('../models/User');
const porFazer = require('./_naoImplementado');

// GET /api/auctions?estado=ativo  -> 200 [leilões]

router.get('/', async (req, res, next) => {
    try {
        const { estado } = req.query;

        const estadosValidos = [
            'agendado',
            'ativo',
            'terminado'
        ];

        if (estado && !estadosValidos.includes(estado)) {
            return res.status(400).json({
                erro: 'Estado de leilão inválido'
            });
        }

        const filtro = estado ? { estado } : {};

        const leiloes = await Auction.find(filtro)
            .populate('produtor', 'nome produtor.nomeExploracao')
            .sort({ terminaEm: 1 });

        res.json(leiloes);
    } catch (err) {
        next(err);
    }
});


// GET /api/auctions/:id  -> 200 leilão + últimas licitações
router.get('/:id', porFazer('Detalhe do leilão'));

// POST /api/auctions  (produtor)  -> 201
// TODO: definir licitacaoAtual.valor = precoBase e terminaEm = iniciaEm + duração

router.post('/', auth('produtor'), async (req, res, next) => {
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

        if (typeof lote !== 'string' || !lote.trim()) {
            return res.status(400).json({
                erro: 'O nome do lote é obrigatório'
            });
        }

        if (!Number.isFinite(base) || base <= 0 ||
            !Number.isFinite(minimo) || minimo <= 0) {
            return res.status(400).json({
                erro: 'Preço base e incremento devem ser positivos'
            });
        }

        if (isNaN(inicio.getTime()) ||
            isNaN(fim.getTime()) ||
            fim <= inicio ||
            fim <= agora) {
            return res.status(400).json({
                erro: 'Datas do leilão inválidas'
            });
        }

        const utilizador = await User.findById(req.user.id);

        if (!utilizador?.produtor?.validado) {
            return res.status(403).json({
                erro: 'O produtor ainda não foi aprovado'
            });
        }

        const leilao = await Auction.create({
            produtor: req.user.id,
            lote: lote.trim(),
            descricao,
            quantidade,
            precoBase: base,
            incremento: minimo,
            licitacaoAtual: { valor: base },
            numLicitacoes: 0,
            iniciaEm: inicio,
            terminaEm: fim,
            estado: inicio <= agora ? 'ativo' : 'agendado'
        });

        return res.status(201)
            .location(`/api/auctions/${leilao._id}`)
            .json(leilao);

    } catch (err) {
        next(err);
    }
});


// GET /api/auctions/:id/bids  -> 200 [licitações]
router.get('/:id/bids', porFazer('Histórico de licitações'));

module.exports = router;
