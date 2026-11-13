
import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Link } from 'react-router-dom';

export default function Leiloes() {
  const [leiloes, setLeiloes] = useState([]);
  const [erro, setErro] = useState('');
  const [aCarregar, setACarregar] = useState(true);
  const [agora, setAgora] = useState(Date.now());

  async function carregarLeiloes() {
    setACarregar(true);
    setErro('');

    try {
      const dados = await api('/auctions?estado=ativo');
      setLeiloes(dados);
    } catch (err) {
      setErro(err.message);
    } finally {
      setACarregar(false);
    }
  }

  useEffect(() => {
    carregarLeiloes();

    const intervalo = setInterval(() => {
      setAgora(Date.now());
    }, 1000);

    return () => clearInterval(intervalo);
  }, []);

  function tempoRestante(dataFim) {
    const segundos = Math.max(
      0,
      Math.floor((new Date(dataFim).getTime() - agora) / 1000)
    );

    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const seg = segundos % 60;

    return [horas, minutos, seg]
      .map((n) => String(n).padStart(2, '0'))
      .join(':');
  }

  const ativos = leiloes.filter(
    (l) => l.estado === 'ativo' &&
      new Date(l.iniciaEm).getTime() <= agora &&
      new Date(l.terminaEm).getTime() > agora
  );

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Leilões em direto</h1>

        <button
          className="btn btn-outline-success"
          onClick={carregarLeiloes}
          disabled={aCarregar}
        >
          Atualizar
        </button>
      </div>

      <p className="text-muted mb-4">
        Descobre os melhores lotes dos produtores
        do Alto Minho e acompanha os leilões.
      </p>

      {erro && (
        <div className="alert alert-danger">
          {erro}
        </div>
      )}

      {aCarregar && <p>A carregar leilões...</p>}

      {!aCarregar && !erro && ativos.length === 0 && (
        <div className="alert alert-info">
          Não existem leilões ativos neste momento.
        </div>
      )}

      <div className="row g-3">
        {ativos.map((leilao) => (
          <div className="col-md-6 col-lg-4" key={leilao._id}>
            <article className="card h-100 shadow-sm">
              <div className="card-body">

                <div className="d-flex justify-content-between mb-3">
                  <span className="badge bg-success">
                    EM DIRETO
                  </span>

                  <span className="text-muted small">
                    {leilao.numLicitacoes || 0} licitações
                  </span>
                </div>

                <h2 className="h5">{leilao.lote}</h2>

                <p className="text-muted">
                  {leilao.produtor?.produtor?.nomeExploracao ||
                    leilao.produtor?.nome ||
                    'Produtor'}
                </p>

                <p>{leilao.descricao}</p>

                <hr />

                <small className="text-muted">
                  Licitação atual
                </small>

                <h3 className="text-success fw-bold">
                  {Number(
                    leilao.licitacaoAtual?.valor ??
                    leilao.precoBase
                  ).toFixed(2)} €
                </h3>

                <p className="mb-2">
                  Incremento mínimo:
                  <strong> {leilao.incremento.toFixed(2)} €</strong>
                </p>

                <p className="mb-2">
                  <strong>Tempo restante</strong>
                </p>

                <div className="fs-4 fw-bold mb-3">
                  {tempoRestante(leilao.terminaEm)}
                </div>


                <Link
                  to={`/leiloes/${leilao._id}`}
                  className="btn btn-success w-100 mt-3"
                >
                  Entrar na sala
                </Link>


              </div>
            </article>
          </div>
        ))}
      </div>
    </>
  );
}
