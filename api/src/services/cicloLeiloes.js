
const Auction = require('../models/Auction');
const User = require('../models/User');
const Order = require('../models/Order');

// Nome da sala Socket.io
const sala = (id) => `leilao:${id}`;

// 1. Abrir os leilões agendados
async function abrirAgendados(io) {
    const agora = new Date();

    const leiloes = await Auction.find({
        estado: 'agendado',
        iniciaEm: { $lte: agora },
        terminaEm: { $gt: agora }
    }).select('_id');

    for (const leilao of leiloes) {
        const atualizado = await Auction.findOneAndUpdate(
            {
                _id: leilao._id,
                estado: 'agendado',
                iniciaEm: { $lte: agora },
                terminaEm: { $gt: agora }
            },
            { $set: { estado: 'ativo' } },
            { new: true }
        );

        if (!atualizado) continue;

        io.to(sala(leilao._id)).emit('aberto', {
            leilaoId: String(leilao._id)
        });

        console.log('Leilão iniciado:', atualizado.lote);
    }
}

// 2. Garantir uma encomenda para o vencedor
async function garantirEncomenda(leilao, io) {
    const compradorId = leilao.licitacaoAtual?.comprador;

    // Sem licitações, não existe vencedor nem encomenda
    if (!compradorId) return null;

    const precoFinal = Number(
        leilao.licitacaoAtual.valor
    );

    if (!Number.isFinite(precoFinal) || precoFinal <= 0) {
        throw new Error(
            `Preço final inválido no leilão ${leilao._id}`
        );
    }

    // Dados da encomenda do leilão
    const dados = {
        comprador: compradorId,
        produtor: leilao.produtor,

        linhas: [{
            ...(leilao.produto
                ? { produto: leilao.produto }
                : {}),
            nome: `Lote: ${leilao.lote}`,
            precoUnit: precoFinal,
            unidade: 'lote',
            quantidade: 1
        }],

        estado: 'confirmada',

        origem: 'leilao',
        leilao: leilao._id,

        entrega: {
            tipo: 'levantamento'
        }
    };

    let encomenda;

    try {
        // Criar apenas se ainda não existir.
        // O índice único de Order.js protege
        // contra duas encomendas para o mesmo leilão.
        encomenda = await Order.findOneAndUpdate(
            { leilao: leilao._id },
            { $setOnInsert: dados },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );
    } catch (err) {
        // Outra instância pode ter criado primeiro
        if (err.code !== 11000) throw err;

        encomenda = await Order.findOne({
            leilao: leilao._id
        });

        if (!encomenda) throw err;
    }

    // Associar a encomenda ao leilão
    // Apenas se ainda não tiver associação
    const associacao = await Auction.updateOne(
        {
            _id: leilao._id,
            encomenda: null
        },
        {
            $set: {
                encomenda: encomenda._id
            }
        }
    );

    // Notificar apenas quando a associação
    // é efetuada pela primeira vez
    if (associacao.modifiedCount > 0) {
        const evento = {
            id: String(encomenda._id),
            leilaoId: String(leilao._id),
            lote: leilao.lote,
            estado: 'confirmada',
            valor: precoFinal
        };

        // Notificar comprador vencedor
        io.to(`user:${compradorId}`).emit(
            'encomenda-criada',
            evento
        );

        // Notificar produtor
        io.to(`user:${leilao.produtor}`).emit(
            'nova-encomenda',
            evento
        );

        console.log(
            'Encomenda do leilão associada:',
            leilao.lote,
            'ID:',
            encomenda._id.toString()
        );
    }

    return encomenda;
}

// 3. Encerrar os leilões expirados
async function fecharExpirados(io) {
    const agora = new Date();

    const leiloes = await Auction.find({
        estado: { $in: ['ativo', 'agendado'] },
        terminaEm: { $lte: agora }
    }).select('_id');

    for (const leilao of leiloes) {
        // Fecho atómico: apenas uma execução
        // consegue alterar o estado
        const atualizado = await Auction.findOneAndUpdate(
            {
                _id: leilao._id,
                estado: { $in: ['ativo', 'agendado'] },
                terminaEm: { $lte: agora }
            },
            {
                $set: {
                    estado: 'terminado'
                }
            },
            { new: true }
        );

        if (!atualizado) continue;

        const compradorId =
            atualizado.licitacaoAtual?.comprador;

        let vencedor = null;
        let encomenda = null;

        if (compradorId) {
            const comprador = await User.findById(
                compradorId
            ).select('nome');

            vencedor = {
                id: String(compradorId),
                nome: comprador?.nome || 'Comprador'
            };

            // Criar encomenda do vencedor
            try {
                encomenda = await garantirEncomenda(
                    atualizado,
                    io
                );
            } catch (err) {
                // O próximo ciclo tentará novamente
                console.error(
                    'Erro ao criar encomenda do leilão:',
                    atualizado._id,
                    err
                );
            }
        }

        // Resultado final
        const resultado = {
            leilaoId: String(atualizado._id),
            lote: atualizado.lote,
            vencedor,
            valor: vencedor
                ? atualizado.licitacaoAtual.valor
                : null,
            encomendaId: encomenda
                ? String(encomenda._id)
                : null
        };

        // Anunciar resultado na sala
        io.to(sala(atualizado._id)).emit(
            'terminado',
            resultado
        );

        // Avisar vencedor
        if (vencedor) {
            io.to(`user:${vencedor.id}`).emit(
                'leilao-vencido',
                resultado
            );
        }

        // Avisar produtor
        io.to(`user:${atualizado.produtor}`).emit(
            'leilao-terminado',
            resultado
        );

        console.log(
            'Leilão terminado:',
            atualizado.lote,
            'Vencedor:',
            vencedor?.nome || 'Sem licitações'
        );
    }
}

// 4. Recuperar encomendas que tenham ficado
// por criar devido a falhas ou que pertençam
// a leilões encerrados antes desta implementação
async function recuperarEncomendas(io) {
    const pendentes = await Auction.find({
        estado: 'terminado',
        'licitacaoAtual.comprador': {
            $exists: true,
            $ne: null
        },
        encomenda: null
    });

    for (const leilao of pendentes) {
        try {
            await garantirEncomenda(leilao, io);
        } catch (err) {
            console.error(
                'Erro ao recuperar encomenda:',
                leilao._id,
                err
            );
        }
    }
}

// 5. Executar automaticamente a cada 2 segundos
function iniciarCicloLeiloes(io) {
    let emExecucao = false;

    async function executar() {
        if (emExecucao) return;

        emExecucao = true;

        try {
            await abrirAgendados(io);

            await fecharExpirados(io);

            await recuperarEncomendas(io);

        } catch (err) {
            console.error(
                'Erro no ciclo de leilões:',
                err
            );
        } finally {
            emExecucao = false;
        }
    }

    executar();

    return setInterval(executar, 2000);
}

module.exports = {
    iniciarCicloLeiloes
};
