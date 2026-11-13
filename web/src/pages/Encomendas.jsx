
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api, API_URL } from '../api/client.js';
import { io } from 'socket.io-client';

const estados = [
  'pendente',
  'confirmada',
  'pronta',
  'entregue'
];

function formatarPreco(valor) {
  return Number(valor).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });
}

// Obter o ID de um produto
function obterIdProduto(produto) {
  if (!produto) return '';
  return String(
    typeof produto === 'object'
      ? produto._id || ''
      : produto
  );
}

export default function Encomendas() {
  const { token } = useAuth();

  const [encomendas, setEncomendas] = useState([]);
  const [erro, setErro] = useState('');
  const [aCarregar, setACarregar] = useState(true);
  const [avisoTempoReal, setAvisoTempoReal] = useState('');

  // Estados do formulário de avaliação
  const [encomendaAvaliar, setEncomendaAvaliar] = useState(null);
  const [tipo, setTipo] = useState('produtor');
  const [produtoSelecionado, setProdutoSelecionado] = useState('');
  const [classificacao, setClassificacao] = useState(5);
  const [comentario, setComentario] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Carregar encomendas da API
  useEffect(() => {
    let ativo = true;

    async function carregar() {
      setACarregar(true);
      setErro('');

      try {
        const dados = await api('/orders', { token });

        if (ativo) {
          setEncomendas(dados);
        }
      } catch (err) {
        if (ativo) {
          setErro(err.message);
        }
      } finally {
        if (ativo) {
          setACarregar(false);
        }
      }
    }

    if (token) {
      carregar();
    } else {
      setEncomendas([]);
      setACarregar(false);
    }

    return () => {
      ativo = false;
    };
  }, [token]);

  // Notificações Socket.io
  useEffect(() => {
    if (!token) return undefined;

    const socket = io(API_URL, {
      auth: { token }
    });

    socket.on('encomenda-atualizada', (evento) => {
      setEncomendas((anteriores) =>
        anteriores.map((encomenda) =>
          String(encomenda._id) ===
            String(evento.encomendaId)
            ? {
              ...encomenda,
              estado: evento.estado
            }
            : encomenda
        )
      );

      setAvisoTempoReal(
        `O estado da tua encomenda foi atualizado para "${evento.estado}".`
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  // Abrir ou fechar o formulário de avaliação
  function abrirAvaliacao(encomenda) {
    if (encomendaAvaliar === encomenda._id) {
      setEncomendaAvaliar(null);
      return;
    }

    const primeiraLinhaComProduto =
      encomenda.linhas.find(
        (linha) => obterIdProduto(linha.produto)
      );

    setEncomendaAvaliar(encomenda._id);
    setTipo('produtor');
    setProdutoSelecionado(
      obterIdProduto(primeiraLinhaComProduto?.produto)
    );
    setClassificacao(5);
    setComentario('');
    setFeedback(null);
  }

  // Enviar a avaliação para a API
  async function enviarAvaliacao(e, encomenda) {
    e.preventDefault();

    if (aEnviar) return;

    setFeedback(null);
    setAEnviar(true);

    try {
      if (tipo === 'produto' && !produtoSelecionado) {
        throw new Error('Seleciona um produto.');
      }

      const corpo = {
        encomenda: encomenda._id,
        tipo,
        classificacao,
        comentario: comentario.trim(),

        ...(tipo === 'produto'
          ? { produto: produtoSelecionado }
          : {})
      };

      await api('/reviews', {
        metodo: 'POST',
        token,
        corpo
      });

      setFeedback({
        encomendaId: encomenda._id,
        sucesso: true,
        mensagem: 'Avaliação enviada com sucesso!'
      });

      setEncomendaAvaliar(null);

    } catch (err) {
      setFeedback({
        encomendaId: encomenda._id,
        sucesso: false,
        mensagem: err.message
      });
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <>
      <h1 className="mb-4">
        As minhas encomendas
      </h1>

      {/* NOTIFICAÇÕES EM TEMPO REAL */}
      {avisoTempoReal && (
        <div
          className="alert alert-success"
          role="status"
          aria-live="polite"
        >
          {avisoTempoReal}
        </div>
      )}

      {erro && (
        <div className="alert alert-danger">
          {erro}
        </div>
      )}

      {aCarregar && (
        <p>A carregar encomendas...</p>
      )}

      {!aCarregar && !erro &&
        encomendas.length === 0 && (
          <div className="alert alert-info">
            Ainda não tens encomendas registadas.
          </div>
        )}

      <div className="row g-3">

        {encomendas.map((o) => {
          const total = o.linhas.reduce(
            (soma, linha) =>
              soma +
              Number(linha.precoUnit) *
              Number(linha.quantidade),
            0
          );

          const produtor =
            o.produtor?.produtor?.nomeExploracao ||
            o.produtor?.nome ||
            'Produtor';

          // Apenas produtos associados a um ID real
          const produtosAvaliaveis = o.linhas.filter(
            (linha) => obterIdProduto(linha.produto)
          );

          const formularioAberto =
            encomendaAvaliar === o._id;

          return (
            <div className="col-12" key={o._id}>
              <article className="card shadow-sm">
                <div className="card-body">

                  {/* CABEÇALHO */}
                  <div className="d-flex justify-content-between flex-wrap gap-2 mb-3">

                    <div>
                      <h2 className="h5 mb-1">
                        Encomenda #{o._id.slice(-6).toUpperCase()}
                      </h2>

                      <p className="text-muted mb-0">
                        {produtor}
                      </p>

                      {o.origem === 'leilao' && (
                        <span className="badge bg-secondary mt-2">
                          Adquirido em leilão
                        </span>
                      )}

                      {o.createdAt && (
                        <small className="d-block text-muted mt-1">
                          {new Date(o.createdAt)
                            .toLocaleString('pt-PT')}
                        </small>
                      )}
                    </div>

                    <span className="badge bg-success align-self-start">
                      {o.estado}
                    </span>
                  </div>

                  {/* EVOLUÇÃO DA ENCOMENDA */}
                  <div className="d-flex justify-content-between gap-2 mb-3 flex-wrap">

                    {estados.map((estado) => (
                      <small
                        key={estado}
                        className={
                          estados.indexOf(estado) <=
                            estados.indexOf(o.estado)
                            ? 'text-success fw-bold'
                            : 'text-muted'
                        }
                      >
                        {estado.charAt(0).toUpperCase() +
                          estado.slice(1)}
                      </small>
                    ))}

                  </div>

                  <hr />

                  {/* PRODUTOS */}
                  <h3 className="h6">
                    Produtos
                  </h3>

                  {o.linhas.map((linha, i) => (
                    <div
                      key={i}
                      className="d-flex justify-content-between gap-2 mb-2"
                    >
                      <span>
                        {linha.quantidade} × {linha.nome}
                      </span>

                      <strong>
                        {formatarPreco(
                          linha.precoUnit *
                          linha.quantidade
                        )}
                      </strong>
                    </div>
                  ))}

                  <hr />

                  {/* TOTAL */}
                  <div className="d-flex justify-content-between">
                    <strong>Total</strong>
                    <strong>
                      {formatarPreco(total)}
                    </strong>
                  </div>

                  <p className="mt-3 mb-0 text-muted">
                    {o.entrega?.tipo === 'entrega'
                      ? `Entrega: ${o.entrega.morada}`
                      : 'Levantamento no produtor'}
                  </p>

                  {/* AVALIAÇÕES */}
                  {o.estado === 'entregue' && (
                    <div className="border-top mt-4 pt-3">

                      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">

                        <div>
                          <h3 className="h6 mb-1">
                            Avaliar a compra
                          </h3>

                          <small className="text-muted">
                            Partilha a tua experiência.
                          </small>
                        </div>

                        <button
                          type="button"
                          className="btn btn-outline-success"
                          onClick={() => abrirAvaliacao(o)}
                        >
                          {formularioAberto
                            ? 'Cancelar'
                            : 'Avaliar'}
                        </button>
                      </div>

                      {/* MENSAGEM DE SUCESSO OU ERRO */}
                      {feedback?.encomendaId === o._id && (
                        <div
                          className={
                            `alert mt-3 ${feedback.sucesso
                              ? 'alert-success'
                              : 'alert-danger'
                            }`
                          }
                          role="status"
                        >
                          {feedback.mensagem}
                        </div>
                      )}

                      {/* FORMULÁRIO */}
                      {formularioAberto && (
                        <form
                          className="mt-4 p-3 bg-light rounded"
                          onSubmit={(e) =>
                            enviarAvaliacao(e, o)
                          }
                        >

                          <h4 className="h6 mb-3">
                            Nova avaliação
                          </h4>

                          <div className="mb-3">
                            <label
                              htmlFor={`tipo-${o._id}`}
                              className="form-label"
                            >
                              O que pretendes avaliar?
                            </label>

                            <select
                              id={`tipo-${o._id}`}
                              className="form-select"
                              value={tipo}
                              onChange={(e) =>
                                setTipo(e.target.value)
                              }
                            >
                              <option value="produtor">
                                Produtor
                              </option>

                              {produtosAvaliaveis.length > 0 && (
                                <option value="produto">
                                  Produto
                                </option>
                              )}
                            </select>
                          </div>

                          {/* SELECIONAR PRODUTO */}
                          {tipo === 'produto' && (
                            <div className="mb-3">

                              <label
                                htmlFor={`produto-${o._id}`}
                                className="form-label"
                              >
                                Selecionar produto
                              </label>

                              <select
                                id={`produto-${o._id}`}
                                className="form-select"
                                value={produtoSelecionado}
                                onChange={(e) =>
                                  setProdutoSelecionado(
                                    e.target.value
                                  )
                                }
                                required
                              >
                                {produtosAvaliaveis.map(
                                  (linha, i) => (
                                    <option
                                      key={i}
                                      value={obterIdProduto(
                                        linha.produto
                                      )}
                                    >
                                      {linha.nome}
                                    </option>
                                  )
                                )}
                              </select>

                            </div>
                          )}

                          {/* CLASSIFICAÇÃO */}
                          <div className="mb-3">

                            <label className="form-label d-block">
                              Classificação
                            </label>

                            <div
                              className="d-flex gap-2 flex-wrap"
                              role="group"
                              aria-label="Classificação de 1 a 5 estrelas"
                            >
                              {[1, 2, 3, 4, 5].map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  className={
                                    classificacao >= n
                                      ? 'btn btn-warning'
                                      : 'btn btn-outline-secondary'
                                  }
                                  onClick={() =>
                                    setClassificacao(n)
                                  }
                                  aria-label={`${n} estrelas`}
                                  aria-pressed={
                                    classificacao === n
                                  }
                                >
                                  ★
                                </button>
                              ))}
                            </div>

                            <small className="text-muted d-block mt-2">
                              {classificacao} de 5 estrelas
                            </small>
                          </div>

                          {/* COMENTÁRIO */}
                          <div className="mb-3">

                            <label
                              htmlFor={`comentario-${o._id}`}
                              className="form-label"
                            >
                              Comentário
                            </label>

                            <textarea
                              id={`comentario-${o._id}`}
                              className="form-control"
                              rows={3}
                              maxLength={1000}
                              placeholder="Como foi a tua experiência?"
                              value={comentario}
                              onChange={(e) =>
                                setComentario(e.target.value)
                              }
                            />

                          </div>

                          <button
                            type="submit"
                            className="btn btn-success"
                            disabled={aEnviar}
                          >
                            {aEnviar
                              ? 'A enviar...'
                              : 'Enviar avaliação'}
                          </button>

                        </form>
                      )}

                    </div>
                  )}

                </div>
              </article>
            </div>
          );
        })}

      </div>
    </>
  );
}
