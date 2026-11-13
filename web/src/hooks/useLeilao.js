
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../api/client.js';

export function useLeilao(id, token) {
  const socketRef = useRef(null);

  const [leilao, setLeilao] = useState(null);
  const [atual, setAtual] = useState(null);
  const [participantes, setParticipantes] = useState(0);
  const [licitacoes, setLicitacoes] = useState([]);

  // Resultado final do leilão
  const [resultado, setResultado] = useState(null);

  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [aLicitar, setALicitar] = useState(false);

  useEffect(() => {
    if (!id || !token) return undefined;

    setLeilao(null);
    setAtual(null);
    setLicitacoes([]);
    setResultado(null);
    setErro('');
    setAviso('');

    const socket = io(API_URL, {
      auth: { token }
    });

    socketRef.current = socket;

    // Entrar ou voltar a entrar na sala
    socket.on('connect', () => {
      setErro('');
      socket.emit('entrar', id);
    });

    // Estado inicial recebido do servidor
    socket.on('estado', (mensagem) => {
      const dados = mensagem?.leilao
        ? mensagem.leilao
        : mensagem;

      if (!dados) return;

      setLeilao(dados);
      setAtual(dados.licitacaoAtual || null);

      const historico = Array.isArray(mensagem?.licitacoes)
        ? mensagem.licitacoes
        : [];

      setLicitacoes(historico);

      // Recuperar o vencedor se o comprador abrir
      // a página depois de o leilão terminar
      if (dados.estado === 'terminado') {
        const ultimo = historico[0];

        const temVencedor = Boolean(
          dados.licitacaoAtual?.comprador
        );

        setResultado({
          leilaoId: String(dados._id),
          lote: dados.lote,
          vencedor: temVencedor
            ? {
              id: String(
                dados.licitacaoAtual.comprador
              ),
              nome:
                ultimo?.nome ||
                dados.licitacaoAtual.nome ||
                'Comprador'
            }
            : null,
          valor: temVencedor
            ? Number(dados.licitacaoAtual.valor)
            : null
        });

        setAviso('Este leilão terminou.');
      } else {
        setResultado(null);
      }
    });

    // Nova licitação em tempo real
    socket.on('nova-licitacao', (evento) => {
      setAtual((anterior) => ({
        ...(anterior || {}),
        ...evento
      }));

      setLeilao((anterior) => {
        if (!anterior) return anterior;

        return {
          ...anterior,
          licitacaoAtual: {
            ...(anterior.licitacaoAtual || {}),
            ...evento
          },
          numLicitacoes:
            evento.numLicitacoes ??
            anterior.numLicitacoes
        };
      });

      setLicitacoes((anteriores) => {
        // Evitar duplicação de licitações
        const lista = anteriores.filter(
          (bid) => bid._id !== evento._id
        );

        return [evento, ...lista].slice(0, 20);
      });
    });

    // Número de participantes
    socket.on('presenca', (numero) => {
      setParticipantes(numero);
    });

    // Licitação recusada
    socket.on('recusada', (mensagem) => {
      setErro(
        typeof mensagem === 'string'
          ? mensagem
          : mensagem?.erro || 'Licitação recusada'
      );
    });

    // Leilão iniciado
    socket.on('aberto', () => {
      socket.emit('entrar', id);
      setAviso('O leilão começou!');
    });

    // ENCERRAMENTO AUTOMÁTICO
    socket.on('terminado', (dados) => {
      setLeilao((anterior) =>
        anterior
          ? { ...anterior, estado: 'terminado' }
          : anterior
      );

      setResultado({
        leilaoId: dados?.leilaoId || id,
        lote: dados?.lote || '',
        vencedor: dados?.vencedor || null,
        valor: dados?.valor ?? null
      });

      setAviso(
        dados?.vencedor
          ? `Leilão terminado! Vencedor: ${dados.vencedor.nome}`
          : 'Leilão terminado sem licitações.'
      );
    });

    socket.on('connect_error', (err) => {
      setErro(`Erro de ligação: ${err.message}`);
    });

    socket.on('disconnect', () => {
      setParticipantes(0);
    });

    return () => {
      socket.emit('sair', id);
      socket.disconnect();
      socketRef.current = null;
    };

  }, [id, token]);

  // Enviar licitação
  async function licitar(valor) {
    setErro('');
    setAviso('');

    const socket = socketRef.current;

    if (!socket?.connected) {
      setErro('Sem ligação ao servidor.');
      return false;
    }

    if (leilao?.estado === 'terminado') {
      setErro('Este leilão já terminou.');
      return false;
    }

    const proposta = Number(valor);

    if (
      !Number.isFinite(proposta) ||
      proposta <= 0 ||
      Math.abs(
        proposta * 100 - Math.round(proposta * 100)
      ) > 0.000001
    ) {
      setErro('Introduz um valor válido em euros.');
      return false;
    }

    setALicitar(true);

    try {
      const resposta = await new Promise(
        (resolve, reject) => {
          socket.timeout(10000).emit(
            'licitar',
            {
              leilaoId: id,
              valor: proposta
            },
            (err, resultado) => {
              if (err) {
                reject(err);
              } else {
                resolve(resultado);
              }
            }
          );
        }
      );

      if (!resposta?.ok) {
        setErro(
          resposta?.erro ||
          'A licitação foi recusada.'
        );
        return false;
      }

      setAviso('Licitação aceite com sucesso!');
      return true;

    } catch (err) {
      setErro(
        'Sem confirmação do servidor. Verifica o preço antes de repetir.'
      );
      return false;

    } finally {
      setALicitar(false);
    }
  }

  return {
    leilao,
    atual,
    participantes,
    licitacoes,
    resultado,
    erro,
    aviso,
    aLicitar,
    licitar
  };
}
