// Painel do administrador — estatísticas, produtores e moderação de avaliações
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

function formatarData(data) {
  return data ? new Date(data).toLocaleString('pt-PT') : '';
}

export default function PainelAdmin() {
  const { token } = useAuth();

  // Estatísticas e aprovação de produtores (funcionalidades existentes)
  const [estatisticas, setEstatisticas] = useState(null);
  const [produtores, setProdutores] = useState([]);
  const [aCarregar, setACarregar] = useState(true);
  const [aProcessar, setAProcessar] = useState(null);

  // Moderação de avaliações
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [aCarregarAvaliacoes, setACarregarAvaliacoes] = useState(true);
  const [aModerar, setAModerar] = useState(null);
  const [erroModeracao, setErroModeracao] = useState('');

  // Mensagens gerais
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    let ativo = true;

    if (!token) {
      setACarregar(false);
      setACarregarAvaliacoes(false);
      return undefined;
    }

    async function carregar() {
      setACarregar(true);
      setACarregarAvaliacoes(true);
      setErro('');
      setErroModeracao('');

      // As três consultas são independentes. Se uma falhar,
      // as outras secções podem continuar a funcionar.
      const [resultadoEstatisticas, resultadoProdutores, resultadoAvaliacoes] =
        await Promise.allSettled([
          api('/admin/estatisticas', { token }),
          api('/admin/produtores/pendentes', { token }),
          api('/admin/reviews/denunciadas', { token })
        ]);

      if (!ativo) return;

      if (resultadoEstatisticas.status === 'fulfilled') {
        setEstatisticas(resultadoEstatisticas.value);
      } else {
        setErro(`Não foi possível carregar as estatísticas: ${resultadoEstatisticas.reason.message}`);
      }

      if (resultadoProdutores.status === 'fulfilled') {
        setProdutores(
          Array.isArray(resultadoProdutores.value)
            ? resultadoProdutores.value
            : []
        );
      } else {
        setErro((anterior) =>
          [anterior, `Erro ao carregar produtores: ${resultadoProdutores.reason.message}`]
            .filter(Boolean)
            .join(' ')
        );
      }

      if (resultadoAvaliacoes.status === 'fulfilled') {
        setAvaliacoes(
          Array.isArray(resultadoAvaliacoes.value)
            ? resultadoAvaliacoes.value
            : []
        );
      } else {
        setErroModeracao(
          `Não foi possível carregar as avaliações denunciadas: ${resultadoAvaliacoes.reason.message}`
        );
      }

      setACarregar(false);
      setACarregarAvaliacoes(false);
    }

    carregar();

    return () => {
      ativo = false;
    };
  }, [token]);

  // Aprovar ou rejeitar um produtor
  async function validarProdutor(id, aprovado) {
    setAProcessar(id);
    setErro('');
    setMensagem('');

    try {
      await api(`/admin/produtores/${id}/validacao`, {
        metodo: 'PATCH',
        token,
        corpo: { aprovado }
      });

      setProdutores((lista) => lista.filter((p) => p._id !== id));
      setMensagem(
        aprovado
          ? 'Produtor aprovado com sucesso!'
          : 'Produtor rejeitado.'
      );
    } catch (err) {
      setErro(err.message);
    } finally {
      setAProcessar(null);
    }
  }

  // Ocultar ou manter pública uma avaliação denunciada
  async function moderarAvaliacao(avaliacao, visivel) {
    if (!visivel) {
      const confirmou = window.confirm(
        'Queres ocultar esta avaliação? Deixará de aparecer publicamente.'
      );
      if (!confirmou) return;
    }

    setAModerar(avaliacao._id);
    setErroModeracao('');
    setMensagem('');

    try {
      await api(`/admin/reviews/${avaliacao._id}`, {
        metodo: 'PATCH',
        token,
        corpo: { visivel }
      });

      // O backend remove a denúncia da fila de moderação:
      // ocultando a avaliação ou resolvendo as denúncias.
      setAvaliacoes((lista) =>
        lista.filter((item) => item._id !== avaliacao._id)
      );

      setMensagem(
        visivel
          ? 'Avaliação mantida pública. Denúncias resolvidas!'
          : 'Avaliação ocultada com sucesso!'
      );
    } catch (err) {
      setErroModeracao(err.message);
    } finally {
      setAModerar(null);
    }
  }

  const indicadores = [
    { titulo: 'Utilizadores registados', valor: estatisticas?.utilizadores },
    { titulo: 'Produtores', valor: estatisticas?.produtores },
    { titulo: 'Encomendas hoje', valor: estatisticas?.encomendasHoje },
    { titulo: 'Leilões ativos', valor: estatisticas?.leiloesAtivos }
  ];

  return (
    <>
      <h1 className="mb-4">Administração</h1>

      {erro && (
        <div className="alert alert-danger" role="alert">
          {erro}
        </div>
      )}

      {mensagem && (
        <div className="alert alert-success" role="status">
          {mensagem}
        </div>
      )}

      {aCarregar && <p>A carregar dados...</p>}

      {/* INDICADORES — funcionalidade existente */}
      {estatisticas && (
        <div className="row g-3 mb-5">
          {indicadores.map((item) => (
            <div className="col-6 col-lg-3" key={item.titulo}>
              <article className="card h-100 shadow-sm">
                <div className="card-body">
                  <p className="text-muted mb-2">{item.titulo}</p>
                  <h2 className="fw-bold mb-0">{item.valor ?? 0}</h2>
                </div>
              </article>
            </div>
          ))}
        </div>
      )}

      {/* APROVAÇÃO DE PRODUTORES — funcionalidade existente */}
      <section aria-labelledby="titulo-produtores">
        <h2 id="titulo-produtores" className="h4 mb-3">
          Produtores por validar
        </h2>

        {!aCarregar && produtores.length === 0 && (
          <div className="alert alert-info">
            Não existem produtores pendentes de validação.
          </div>
        )}

        <div className="row g-3">
          {produtores.map((p) => (
            <div className="col-md-6" key={p._id}>
              <article className="card h-100">
                <div className="card-body">
                  <h3 className="h5">
                    {p.produtor?.nomeExploracao || p.nome}
                  </h3>
                  <p className="mb-1">{p.email}</p>
                  <p className="text-muted">{p.produtor?.localidade}</p>

                  <div className="d-flex gap-2 flex-wrap">
                    <button
                      type="button"
                      className="btn btn-success"
                      disabled={aProcessar !== null}
                      onClick={() => validarProdutor(p._id, true)}
                    >
                      {aProcessar === p._id ? 'A processar...' : 'Aprovar'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      disabled={aProcessar !== null}
                      onClick={() => validarProdutor(p._id, false)}
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>
              </article>
            </div>
          ))}
        </div>
      </section>

      {/* NOVA SECÇÃO: MODERAÇÃO DE AVALIAÇÕES */}
      <section className="mt-5" aria-labelledby="titulo-moderacao">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
          <h2 id="titulo-moderacao" className="h4 mb-0">
            Moderação de avaliações
          </h2>
          {!aCarregarAvaliacoes && !erroModeracao && (
            <span className="badge bg-secondary">
              {avaliacoes.length} por analisar
            </span>
          )}
        </div>

        {erroModeracao && (
          <div className="alert alert-danger" role="alert">
            {erroModeracao}
          </div>
        )}

        {aCarregarAvaliacoes && (
          <p>A carregar avaliações denunciadas...</p>
        )}

        {!aCarregarAvaliacoes && !erroModeracao && avaliacoes.length === 0 && (
          <div className="alert alert-info">
            Não existem avaliações denunciadas por analisar.
          </div>
        )}

        <div className="row g-3">
          {avaliacoes.map((avaliacao) => {
            const nomeProdutor =
              avaliacao.produtor?.produtor?.nomeExploracao ||
              avaliacao.produtor?.nome ||
              'Produtor';

            return (
              <div className="col-12 col-lg-6" key={avaliacao._id}>
                <article className="card h-100 shadow-sm">
                  <div className="card-body">
                    <div className="d-flex justify-content-between flex-wrap gap-2 mb-2">
                      <h3 className="h5 mb-0">
                        {avaliacao.autor?.nome || 'Comprador'}
                      </h3>
                      <span className="badge bg-warning text-dark align-self-start">
                        {avaliacao.denuncias} denúncia(s)
                      </span>
                    </div>

                    <p className="text-muted mb-2">
                      Produtor: {nomeProdutor}
                    </p>

                    <p className="mb-2">
                      <span aria-label={`${avaliacao.classificacao} de 5 estrelas`}>
                        <span style={{ color: '#d49a19' }}>
                          {'★'.repeat(Math.max(0, Math.min(5, avaliacao.classificacao)))}
                        </span>
                        <span style={{ color: '#aaa' }}>
                          {'☆'.repeat(5 - Math.max(0, Math.min(5, avaliacao.classificacao)))}
                        </span>
                      </span>
                      <span className="ms-2">{avaliacao.classificacao}/5</span>
                    </p>

                    <p className="small text-muted mb-2">
                      Tipo: {avaliacao.tipo === 'produto' ? 'Produto' : 'Produtor'}
                      {avaliacao.tipo === 'produto' && avaliacao.produto?.nome
                        ? ` — ${avaliacao.produto.nome}`
                        : ''}
                    </p>

                    <p className="mb-2">
                      {avaliacao.comentario || 'Avaliação sem comentário.'}
                    </p>

                    {avaliacao.createdAt && (
                      <p className="small text-muted mb-3">
                        {formatarData(avaliacao.createdAt)}
                      </p>
                    )}

                    <div className="d-flex gap-2 flex-wrap mt-auto">
                      <button
                        type="button"
                        className="btn btn-outline-danger"
                        disabled={aModerar !== null}
                        onClick={() => moderarAvaliacao(avaliacao, false)}
                      >
                        {aModerar === avaliacao._id ? 'A processar...' : 'Ocultar avaliação'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-success"
                        disabled={aModerar !== null}
                        onClick={() => moderarAvaliacao(avaliacao, true)}
                      >
                        Manter pública
                      </button>
                    </div>
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
