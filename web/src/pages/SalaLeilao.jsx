
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLeilao } from '../hooks/useLeilao.js';

export default function SalaLeilao() {
  const { id } = useParams();
  const { token, utilizador } = useAuth();

  const {
    leilao,
    atual,
    participantes,
    licitacoes,
    resultado,
    erro,
    aviso,
    aLicitar,
    licitar
  } = useLeilao(id, token);

  const [agora, setAgora] = useState(Date.now());
  const [valor, setValor] = useState('');
  const [erroFormulario, setErroFormulario] = useState('');

  // Atualizar o relógio a cada segundo
  useEffect(() => {
    const intervalo = setInterval(() => {
      setAgora(Date.now());
    }, 1000);

    return () => clearInterval(intervalo);
  }, []);

  // Valores atuais do leilão
  const precoAtual = Number(
    atual?.valor ?? leilao?.precoBase ?? 0
  );

  const incremento = Number(leilao?.incremento ?? 0);

  const minimo = Math.round(
    (precoAtual + incremento + Number.EPSILON) * 100
  ) / 100;

  // Atualizar o valor sugerido automaticamente
  useEffect(() => {
    if (leilao) {
      setValor(minimo.toFixed(2));
    }
  }, [leilao?._id, minimo]);

  function tempoRestante(data) {
    if (!data) return '--:--:--';

    const total = Math.max(
      0,
      Math.floor(
        (new Date(data).getTime() - agora) / 1000
      )
    );

    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;

    return [h, m, s]
      .map((v) => String(v).padStart(2, '0'))
      .join(':');
  }

  // Estados do leilão
  const leilaoAtivo =
    leilao?.estado === 'ativo' &&
    agora >= new Date(leilao?.iniciaEm).getTime() &&
    agora < new Date(leilao?.terminaEm).getTime();

  const leilaoTerminado =
    leilao?.estado === 'terminado';

  const podeLicitar =
    leilaoAtivo &&
    utilizador?.papel === 'comprador';

  // Maior licitação
  const maiorLicitacao = licitacoes[0] || null;

  // Enviar licitação para o servidor
  function submeterLicitacao(e) {
    e.preventDefault();
    setErroFormulario('');

    if (aLicitar) return;

    const proposta = Number(valor);

    if (!podeLicitar) {
      setErroFormulario(
        'Não tens permissão para licitar neste leilão.'
      );
      return;
    }

    if (!Number.isFinite(proposta) || proposta < minimo) {
      setErroFormulario(
        `A licitação mínima é ${minimo.toFixed(2)} €.`
      );
      return;
    }

    licitar(proposta);
  }

  // Enquanto recebe os dados
  if (!leilao) {
    return (
      <div>
        <h1>Sala de leilão</h1>
        <p>A ligar ao leilão...</p>

        {erro && (
          <div className="alert alert-warning">
            {erro}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <Link
        to="/leiloes"
        className="btn btn-outline-secondary mb-4"
      >
        Voltar aos leilões
      </Link>

      <div className="row g-4">

        {/* COLUNA ESQUERDA */}
        <div className="col-lg-7">

          <h1>{leilao.lote}</h1>

          <p className="text-muted">
            {leilao.produtor?.produtor?.nomeExploracao ||
              leilao.produtor?.nome ||
              'Produtor'}
          </p>

          {/* INFORMAÇÕES DO LEILÃO */}
          <div className="card mb-4">
            <div className="card-body">

              <h2 className="h5 mb-3">
                Informações do leilão
              </h2>

              {leilao.descricao && (
                <p>{leilao.descricao}</p>
              )}

              <p>
                Quantidade: {leilao.quantidade}
              </p>

              <p>
                Preço inicial:{' '}
                {Number(leilao.precoBase).toFixed(2)} €
              </p>

              <p>
                Incremento mínimo:{' '}
                {incremento.toFixed(2)} €
              </p>

              <p className="mb-0">
                Estado:{' '}
                <strong>
                  {leilaoTerminado
                    ? 'Terminado'
                    : leilaoAtivo
                      ? 'Em direto'
                      : leilao.estado === 'ativo'
                        ? 'Fora do período de licitações'
                        : 'Agendado'}
                </strong>
              </p>

            </div>
          </div>

          {/* ANÚNCIO DO VENCEDOR */}
          {leilaoTerminado && (
            <div className="card border-success mb-4">
              <div className="card-body">

                <h2 className="h4 mb-3">
                  🏆 Leilão terminado!
                </h2>

                {resultado ? (
                  resultado.vencedor ? (
                    <>
                      <p className="text-muted mb-1">
                        Vencedor do leilão
                      </p>

                      <h3 className="h4">
                        {resultado.vencedor.nome}
                      </h3>

                      <p className="text-muted mb-1 mt-3">
                        Licitação vencedora
                      </p>

                      <h3 className="text-success fw-bold">
                        {Number(resultado.valor).toFixed(2)} €
                      </h3>

                      <div className="alert alert-success mt-3 mb-0">
                        O leilão foi encerrado e o
                        vencedor foi identificado!
                      </div>
                    </>
                  ) : (
                    <div className="alert alert-info mb-0">
                      O leilão terminou sem licitações.
                      Não existe vencedor.
                    </div>
                  )
                ) : (
                  <p className="mb-0">
                    A confirmar o resultado final...
                  </p>
                )}

              </div>
            </div>
          )}

          {/* HISTÓRICO DE LICITAÇÕES */}
          <section className="card">
            <div className="card-body">

              <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className="h5 mb-0">
                  Histórico de licitações
                </h2>

                <span
                  className={
                    leilaoTerminado
                      ? 'badge bg-secondary'
                      : 'badge bg-success'
                  }
                >
                  {leilaoTerminado
                    ? 'Concluído'
                    : 'Em tempo real'}
                </span>
              </div>

              {licitacoes.length === 0 ? (
                <div className="alert alert-info">
                  Ainda não existem licitações neste leilão.
                </div>
              ) : (
                <div className="list-group">

                  {licitacoes.map((bid, index) => (
                    <div
                      key={bid._id || index}
                      className="list-group-item d-flex justify-content-between align-items-center"
                    >
                      <div>
                        <strong>
                          {bid.nome || 'Comprador'}
                        </strong>

                        <div className="small text-muted mt-1">
                          {bid.createdAt
                            ? new Date(bid.createdAt)
                              .toLocaleString('pt-PT')
                            : 'Agora'}
                        </div>
                      </div>

                      <div className="text-end">

                        <strong className="text-success fs-5">
                          {Number(bid.valor).toFixed(2)} €
                        </strong>

                        {index === 0 && (
                          <div>
                            <span className="badge bg-success">
                              {leilaoTerminado
                                ? 'Proposta vencedora'
                                : 'Maior proposta'}
                            </span>
                          </div>
                        )}

                      </div>
                    </div>
                  ))}

                </div>
              )}

            </div>
          </section>

        </div>

        {/* COLUNA DIREITA */}
        <div className="col-lg-5">

          <div className="card">
            <div className="card-body">

              <p className="text-muted">
                {participantes} participante(s) na sala
              </p>

              <h2 className="h5">
                {leilaoTerminado
                  ? 'Tempo encerrado'
                  : 'Tempo restante'}
              </h2>

              <p className="fs-2 fw-bold">
                {tempoRestante(leilao.terminaEm)}
              </p>

              <hr />

              <p className="mb-2">
                {leilaoTerminado
                  ? 'Valor final'
                  : 'Licitação atual'}
              </p>

              <h2 className="text-success fw-bold">
                {precoAtual.toFixed(2)} €
              </h2>

              {/* MAIOR LICITADOR */}
              {!leilaoTerminado && maiorLicitacao && (
                <div className="alert alert-success mt-3">

                  <strong>
                    🏆 Maior licitador
                  </strong>

                  <p className="mb-1 mt-2">
                    {maiorLicitacao.nome || 'Comprador'}
                  </p>

                  <p className="mb-0">
                    Valor:{' '}
                    <strong>
                      {Number(
                        maiorLicitacao.valor
                      ).toFixed(2)} €
                    </strong>
                  </p>

                </div>
              )}



              {/* PRÓXIMA LICITAÇÃO */}
              {leilaoAtivo && (
                <p>
                  Próxima licitação mínima:
                  <strong>
                    {' '}{minimo.toFixed(2)} €
                  </strong>
                </p>
              )}

              <hr />

              {/* FORMULÁRIO PARA LICITAR */}
              {podeLicitar ? (
                <form onSubmit={submeterLicitacao}>

                  <h3 className="h5 mb-3">
                    Fazer uma licitação
                  </h3>

                  <label
                    htmlFor="valorLicitacao"
                    className="form-label"
                  >
                    A tua licitação (€)
                  </label>

                  <input
                    id="valorLicitacao"
                    type="number"
                    className="form-control mb-3"
                    min={minimo.toFixed(2)}
                    step="0.01"
                    value={valor}
                    onChange={(e) =>
                      setValor(e.target.value)
                    }
                    required
                  />

                  {erroFormulario && (
                    <div className="alert alert-danger">
                      {erroFormulario}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn btn-success w-100"
                    disabled={aLicitar}
                  >
                    {aLicitar ? 'A licitar...' : 'Licitar'}
                  </button>

                </form>
              ) : (
                <div className="alert alert-info">
                  {leilaoTerminado
                    ? 'Este leilão terminou. Não são permitidas novas licitações.'
                    : leilaoAtivo
                      ? 'Apenas compradores podem licitar.'
                      : 'Este leilão não está disponível para licitações.'}
                </div>
              )}

              {/* MENSAGENS DO SERVIDOR */}
              {aviso && !leilaoTerminado && (
                <div
                  className="alert alert-success mt-3"
                  role="status"
                >
                  {aviso}
                </div>
              )}

              {erro && (
                <div className="alert alert-warning mt-3">
                  {erro}
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </>
  );
}
