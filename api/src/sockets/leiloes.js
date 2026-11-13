
const mongoose = require('mongoose');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const User = require('../models/User');

const sala = (id) => `leilao:${id}`;

// Contar os participantes na sala
function emitirPresenca(io, id) {
  const total =
    io.sockets.adapter.rooms.get(sala(id))?.size ?? 0;

  io.to(sala(id)).emit('presenca', total);
}

module.exports = (io, socket) => {

  // 1. Entrar numa sala de leilão
  socket.on('entrar', async (id) => {
    try {
      if (!mongoose.isValidObjectId(id)) {
        socket.emit('recusada', 'Identificador inválido');
        return;
      }

      const leilao = await Auction.findById(id)
        .populate(
          'produtor',
          'nome produtor.nomeExploracao'
        );

      if (!leilao) {
        socket.emit(
          'recusada',
          'Leilão não encontrado'
        );
        return;
      }

      // Obter as últimas 20 licitações
      const historico = await Bid.find({
        leilao: id
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('comprador', 'nome');

      socket.join(sala(id));

      // Enviar estado atual ao comprador
      socket.emit('estado', {
        leilao,
        licitacoes: historico.map((bid) => ({
          _id: String(bid._id),
          valor: bid.valor,
          nome: bid.comprador?.nome || 'Comprador',
          createdAt: bid.createdAt
        }))
      });

      emitirPresenca(io, id);

    } catch (err) {
      console.error('Erro ao entrar na sala:', err);
      socket.emit(
        'recusada',
        'Erro ao abrir a sala'
      );
    }
  });

  // 2. Sair da sala
  socket.on('sair', (id) => {
    if (!mongoose.isValidObjectId(id)) return;

    socket.leave(sala(id));
    emitirPresenca(io, id);
  });

  // 3. FAZER UMA LICITAÇÃO
  socket.on(
    'licitar',
    async ({ leilaoId, valor } = {}, ack) => {

      function responder(resposta) {
        if (typeof ack === 'function') {
          ack(resposta);
        }
      }

      function recusar(mensagem) {
        socket.emit('recusada', mensagem);
        responder({
          ok: false,
          erro: mensagem
        });
      }

      // Verificar o papel do utilizador
      if (socket.user?.papel !== 'comprador') {
        return recusar(
          'Apenas compradores podem licitar'
        );
      }

      // Validar identificador
      if (!mongoose.isValidObjectId(leilaoId)) {
        return recusar('Identificador inválido');
      }

      // Verificar se está na sala
      if (!socket.rooms.has(sala(leilaoId))) {
        return recusar(
          'Entra primeiro na sala do leilão'
        );
      }

      // Validar valor monetário
      if (
        typeof valor !== 'number' ||
        !Number.isFinite(valor) ||
        valor <= 0 ||
        Math.abs(
          valor * 100 - Math.round(valor * 100)
        ) > 0.000001
      ) {
        return recusar(
          'Introduz um valor positivo com até duas casas decimais'
        );
      }

      let session;
      let bidCriada;
      let atualizado;

      try {
        const comprador = await User.findById(
          socket.user.id
        ).select('nome').lean();

        if (!comprador) {
          return recusar(
            'Comprador não encontrado'
          );
        }

        // Iniciar transação MongoDB
        session = await mongoose.startSession();

        await session.withTransaction(async () => {
          const agora = new Date();

          // Atualização atómica do preço
          atualizado = await Auction.findOneAndUpdate(
            {
              _id: leilaoId,
              estado: 'ativo',
              iniciaEm: { $lte: agora },
              terminaEm: { $gt: agora },

              // A nova proposta deve ser pelo menos
              // o valor atual + incremento mínimo
              $expr: {
                $gte: [
                  valor,
                  {
                    $round: [
                      {
                        $add: [
                          {
                            $ifNull: [
                              '$licitacaoAtual.valor',
                              '$precoBase'
                            ]
                          },
                          '$incremento'
                        ]
                      },
                      2
                    ]
                  }
                ]
              }
            },
            {
              $set: {
                'licitacaoAtual.valor': valor,
                'licitacaoAtual.comprador':
                  socket.user.id
              },
              $inc: {
                numLicitacoes: 1
              }
            },
            {
              new: true,
              runValidators: true,
              session,
              strict: false
            }
          ).lean();

          // Proposta rejeitada
          if (!atualizado) {
            const erro = new Error(
              'Leilão terminado ou proposta abaixo do mínimo atual'
            );

            erro.negocio = true;
            throw erro;
          }

          // Guardar no histórico de licitações
          [bidCriada] = await Bid.create(
            [{
              leilao: leilaoId,
              comprador: socket.user.id,
              valor
            }],
            { session }
          );
        });

        // A transação terminou com sucesso.
        // Notificar todos os participantes.
        const evento = {
          _id: String(bidCriada._id),
          valor,
          comprador: String(socket.user.id),
          nome: comprador.nome,
          createdAt: bidCriada.createdAt,
          numLicitacoes: atualizado.numLicitacoes
        };

        io.to(sala(leilaoId)).emit(
          'nova-licitacao',
          evento
        );

        // Confirmar ao comprador
        responder({
          ok: true,
          valor
        });

      } catch (err) {
        if (!err.negocio) {
          console.error('Erro ao licitar:', err);
        }

        recusar(
          err.negocio
            ? err.message
            : 'Não foi possível confirmar a proposta; verifica o preço antes de repetir'
        );

      } finally {
        if (session) {
          await session.endSession();
        }
      }
    }
  );

  // 4. Atualizar participantes ao desligar
  socket.on('disconnecting', () => {
    for (const nomeSala of socket.rooms) {
      if (nomeSala.startsWith('leilao:')) {
        setImmediate(() => {
          emitirPresenca(
            io,
            nomeSala.slice('leilao:'.length)
          );
        });
      }
    }
  });

};
