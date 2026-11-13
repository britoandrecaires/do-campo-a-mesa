
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

function formatarPreco(valor) {
  return Number(valor).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });
}

function obterLista(resposta, campo) {
  if (Array.isArray(resposta)) return resposta;
  if (Array.isArray(resposta?.[campo])) {
    return resposta[campo];
  }
  if (Array.isArray(resposta?.items)) {
    return resposta.items;
  }
  return [];
}

function obterCoordenadas(perfil) {
  const local =
    perfil?.produtor?.localizacao ||
    perfil?.localizacao ||
    {};

  // Formato GeoJSON: [longitude, latitude]
  if (
    local.type === 'Point' &&
    Array.isArray(local.coordinates) &&
    local.coordinates.length >= 2
  ) {
    const [longitude, latitude] = local.coordinates;

    if (
      Number.isFinite(Number(latitude)) &&
      Number.isFinite(Number(longitude)) &&
      Math.abs(Number(latitude)) <= 90 &&
      Math.abs(Number(longitude)) <= 180
    ) {
      return {
        latitude: Number(latitude),
        longitude: Number(longitude)
      };
    }
  }

  // Formato simples
  const latitude = Number(
    local.latitude ?? local.lat
  );

  const longitude = Number(
    local.longitude ?? local.lng ?? local.lon
  );

  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    (local.latitude != null || local.lat != null)
  ) {
    return { latitude, longitude };
  }

  return null;
}

function Estrelas({ valor }) {
  const nota = Number(valor) || 0;

  return (
    <span aria-label={`${nota} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          style={{
            color: n <= Math.round(nota)
              ? '#d49a19'
              : '#b9b9b9',
            fontSize: '1.35rem'
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

// Só o autor da avaliação fica impedido de a denunciar.
function eAutorDaAvaliacao(avaliacao, utilizador) {
  const userId = utilizador?._id || utilizador?.id;
  const autorId = avaliacao.autor?._id || avaliacao.autor;

  return Boolean(
    userId && autorId && String(userId) === String(autorId)
  );
}

export default function Produtor() {
  const { id } = useParams();
  const { token, utilizador } = useAuth();

  const [perfil, setPerfil] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  // Estado das denúncias enviadas nesta visita
  const [aDenunciar, setADenunciar] = useState(null);
  const [denunciadas, setDenunciadas] = useState({});
  const [mensagensDenuncia, setMensagensDenuncia] = useState({});

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      setACarregar(true);
      setErro('');
      setAviso('');
      setDenunciadas({});
      setMensagensDenuncia({});

      // As três consultas são independentes.
      const resultados = await Promise.allSettled([
        api(`/producers/${id}`),
        api(`/reviews?produtor=${id}`),
        api(`/products?produtor=${id}`)
      ]);

      if (!ativo) return;

      const [rPerfil, rAvaliacoes, rProdutos] = resultados;

      if (rPerfil.status === 'fulfilled') {
        const dados = rPerfil.value;

        setPerfil(
          dados?.utilizador ||
          dados?.user ||
          dados?.perfil ||
          (
            dados?.produtor?._id
              ? dados.produtor
              : dados
          )
        );
      } else {
        setErro(
          rPerfil.reason?.message ||
          'Não foi possível carregar o produtor.'
        );
      }

      if (rAvaliacoes.status === 'fulfilled') {
        setAvaliacoes(
          obterLista(rAvaliacoes.value, 'avaliacoes')
        );
      } else {
        setAviso(
          'As avaliações não estão disponíveis neste momento.'
        );
      }

      if (rProdutos.status === 'fulfilled') {
        const lista = obterLista(
          rProdutos.value,
          'produtos'
        );

        // Segurança: não apresentar produtos
        // de outros produtores, caso a API
        // devolva um catálogo geral.
        setProdutos(
          lista.filter((produto) => {
            const dono =
              produto.produtor?._id ||
              produto.produtor ||
              produto.produtorId;

            return (
              String(dono) === String(id) &&
              produto.ativo !== false &&
              produto.estado !== 'inativo'
            );
          })
        );
      }

      setACarregar(false);
    }

    carregar();

    return () => {
      ativo = false;
    };
  }, [id]);

  // Denunciar uma avaliação pública através da API protegida.
  async function denunciarAvaliacao(avaliacao) {
    if (!token || eAutorDaAvaliacao(avaliacao, utilizador)) return;
    if (aDenunciar !== null || denunciadas[avaliacao._id]) return;

    const confirmar = window.confirm(
      'Queres denunciar esta avaliação para análise do administrador?'
    );
    if (!confirmar) return;

    setADenunciar(avaliacao._id);
    setMensagensDenuncia((anteriores) => ({
      ...anteriores,
      [avaliacao._id]: null
    }));

    try {
      await api(`/reviews/${avaliacao._id}/denuncia`, {
        metodo: 'POST',
        token
      });

      setDenunciadas((anteriores) => ({
        ...anteriores,
        [avaliacao._id]: true
      }));

      setMensagensDenuncia((anteriores) => ({
        ...anteriores,
        [avaliacao._id]: {
          sucesso: true,
          texto: 'Denúncia enviada para análise do administrador.'
        }
      }));
    } catch (err) {
      setMensagensDenuncia((anteriores) => ({
        ...anteriores,
        [avaliacao._id]: {
          sucesso: false,
          texto: err.message || 'Não foi possível enviar a denúncia.'
        }
      }));
    } finally {
      setADenunciar(null);
    }
  }

  if (aCarregar) {
    return <p>A carregar perfil do produtor...</p>;
  }

  if (erro || !perfil) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger">
          {erro || 'Produtor não encontrado.'}
        </div>

        <Link to="/produtos" className="btn btn-outline-success">
          Voltar aos produtos
        </Link>
      </div>
    );
  }

  const info = perfil.produtor || {};

  const nome =
    info.nomeExploracao ||
    perfil.nomeExploracao ||
    perfil.nome ||
    'Produtor local';

  const descricao =
    info.descricao ||
    info.apresentacao ||
    perfil.descricao ||
    'Produtor de produtos locais.';

  const localizacao =
    info.morada ||
    info.localidade ||
    info.concelho ||
    perfil.morada ||
    perfil.localidade ||
    '';

  // Média das avaliações do produtor.
  // Não misturamos avaliações de produtos.
  const avaliacoesProdutor = avaliacoes.filter(
    (avaliacao) =>
      avaliacao.tipo === 'produtor' &&
      avaliacao.visivel !== false
  );

  const media = avaliacoesProdutor.length
    ? avaliacoesProdutor.reduce(
      (total, avaliacao) =>
        total + Number(avaliacao.classificacao),
      0
    ) / avaliacoesProdutor.length
    : 0;

  const coordenadas = obterCoordenadas(perfil);

  let urlMapa = '';

  if (coordenadas) {
    const { latitude, longitude } = coordenadas;
    const margem = 0.015;

    const bbox = [
      longitude - margem,
      latitude - margem,
      longitude + margem,
      latitude + margem
    ].join(',');

    urlMapa =
      'https://www.openstreetmap.org/export/embed.html' +
      `?bbox=${encodeURIComponent(bbox)}` +
      '&layer=mapnik' +
      `&marker=${latitude}%2C${longitude}`;
  }

  return (
    <div className="container py-4">

      <Link
        to="/produtos"
        className="btn btn-outline-secondary mb-4"
      >
        Voltar aos produtos
      </Link>

      {/* APRESENTAÇÃO */}
      <section className="card mb-4">
        <div className="card-body p-4">

          <span className="badge bg-success mb-3">
            Produtor local
          </span>

          <h1 className="mb-2">
            {nome}
          </h1>

          {localizacao && (
            <p className="text-muted mb-3">
              📍 {localizacao}
            </p>
          )}

          <p className="lead mb-4">
            {descricao}
          </p>

          <div className="d-flex align-items-center gap-3 flex-wrap">
            <Estrelas valor={media} />

            <strong>
              {avaliacoesProdutor.length
                ? media.toFixed(1).replace('.', ',')
                : 'Sem classificação'}
            </strong>

            <span className="text-muted">
              {avaliacoesProdutor.length} avaliação(ões)
              do produtor
            </span>
          </div>

        </div>
      </section>

      {/* LOCALIZAÇÃO */}
      <section className="mb-5">
        <h2 className="h4 mb-3">
          Localização da exploração
        </h2>

        {urlMapa ? (
          <iframe
            title={`Mapa da exploração ${nome}`}
            src={urlMapa}
            width="100%"
            height="320"
            style={{
              border: '1px solid #ddd',
              borderRadius: '12px'
            }}
            loading="lazy"
          />
        ) : (
          <div className="alert alert-light border">
            {localizacao
              ? `Localização: ${localizacao}. Mapa GPS ainda indisponível.`
              : 'Localização GPS ainda não disponibilizada.'}
          </div>
        )}
      </section>

      {/* PRODUTOS */}
      <section className="mb-5">

        <h2 className="h4 mb-3">
          Produtos disponíveis
        </h2>

        {produtos.length === 0 ? (
          <div className="alert alert-light border">
            Não existem produtos disponíveis para apresentar.
          </div>
        ) : (
          <div className="row g-3">
            {produtos.map((produto) => (
              <div
                className="col-12 col-md-6 col-lg-4"
                key={produto._id}
              >
                <article className="card h-100">
                  <div className="card-body">

                    <h3 className="h5">
                      {produto.nome}
                    </h3>

                    {produto.descricao && (
                      <p className="text-muted">
                        {produto.descricao}
                      </p>
                    )}

                    <strong className="text-success">
                      {formatarPreco(produto.preco)}
                    </strong>

                    {produto.unidade && (
                      <span className="text-muted ms-1">
                        / {produto.unidade}
                      </span>
                    )}

                    <div className="mt-3">
                      <Link
                        to="/produtos"
                        className="btn btn-outline-success btn-sm"
                      >
                        Ver catálogo
                      </Link>
                    </div>

                  </div>
                </article>
              </div>
            ))}
          </div>
        )}

      </section>

      {/* AVALIAÇÕES */}
      <section className="mb-5">

        <h2 className="h4 mb-3">
          Avaliações dos compradores
        </h2>

        {aviso && (
          <div className="alert alert-warning">
            {aviso}
          </div>
        )}

        {avaliacoes.length === 0 && !aviso ? (
          <div className="alert alert-light border">
            Este produtor ainda não recebeu avaliações.
          </div>
        ) : (
          <div className="row g-3">

            {avaliacoes.map((avaliacao) => (
              <div
                key={avaliacao._id}
                className="col-12 col-md-6"
              >
                <article className="card h-100">
                  <div className="card-body">

                    <div className="d-flex justify-content-between gap-2 flex-wrap">

                      <strong>
                        {avaliacao.autor?.nome ||
                          'Comprador'}
                      </strong>

                      <span className="badge bg-secondary">
                        {avaliacao.tipo === 'produtor'
                          ? 'Produtor'
                          : 'Produto'}
                      </span>
                    </div>

                    <div className="my-2">
                      <Estrelas
                        valor={avaliacao.classificacao}
                      />
                      <span className="ms-2">
                        {avaliacao.classificacao}/5
                      </span>
                    </div>

                    {avaliacao.tipo === 'produto' && (
                      <p className="fw-semibold mb-2">
                        {avaliacao.produto?.nome ||
                          'Produto'}
                      </p>
                    )}

                    <p className="mb-2">
                      {avaliacao.comentario ||
                        'Avaliação sem comentário.'}
                    </p>

                    {avaliacao.createdAt && (
                      <small className="text-muted">
                        {new Date(avaliacao.createdAt)
                          .toLocaleDateString('pt-PT')}
                      </small>
                    )}

                    {/* Permitir denúncias apenas a outros utilizadores autenticados */}
                    {!eAutorDaAvaliacao(avaliacao, utilizador) && (
                      <div className="border-top mt-3 pt-3">
                        {token ? (
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => denunciarAvaliacao(avaliacao)}
                            disabled={
                              aDenunciar !== null ||
                              Boolean(denunciadas[avaliacao._id])
                            }
                          >
                            {denunciadas[avaliacao._id]
                              ? 'Denúncia enviada'
                              : aDenunciar === avaliacao._id
                                ? 'A enviar denúncia...'
                                : 'Denunciar avaliação'}
                          </button>
                        ) : (
                          <small className="text-muted">
                            <Link to="/login">Inicia sessão</Link>
                            {' '}para denunciar esta avaliação.
                          </small>
                        )}
                      </div>
                    )}

                    {mensagensDenuncia[avaliacao._id] && (
                      <div
                        role="status"
                        className={`alert mt-3 mb-0 ${mensagensDenuncia[avaliacao._id].sucesso
                            ? 'alert-success'
                            : 'alert-danger'
                          }`}
                      >
                        {mensagensDenuncia[avaliacao._id].texto}
                      </div>
                    )}

                  </div>
                </article>
              </div>
            ))}
          </div>
        )}

      </section>

    </div>
  );
}
