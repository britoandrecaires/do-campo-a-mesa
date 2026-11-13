
import { useEffect, useState } from 'react';

import CartaoProduto from '../components/CartaoProduto.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api, USAR_DADOS_SIMULADOS } from '../api/client.js';
import produtosSimulados from '../data/produtos.json';

const CATEGORIAS = [
  'Todos',
  'Hortícolas',
  'Fruta',
  'Mel',
  'Vinho',
  'Queijo',
  'Padaria',
  'Outros'
];

const EPOCAS = [
  'Todas',
  'Primavera',
  'Verão',
  'Outono',
  'Inverno'
];

const FILTRO_INICIAL = {
  q: '',
  categoria: 'Todos',
  bio: false,
  precoMax: '',
  epoca: 'Todas',
  ordenacao: 'recentes'
};

// Permitir testar os filtros mesmo com dados simulados
function filtrarProdutosSimulados(lista, filtro) {
  const pesquisa = filtro.q.trim().toLowerCase();

  const filtrados = lista.filter((p) => {
    const correspondeNome = String(p.nome || '')
      .toLowerCase()
      .includes(pesquisa);

    const correspondeCategoria =
      filtro.categoria === 'Todos' ||
      p.categoria === filtro.categoria;

    const correspondeBio =
      !filtro.bio || p.biologico === true;

    const correspondePreco =
      filtro.precoMax === '' ||
      Number(p.preco) <= Number(filtro.precoMax);

    const correspondeEpoca =
      filtro.epoca === 'Todas' ||
      (Array.isArray(p.epocas) &&
        p.epocas.includes(filtro.epoca));

    return (
      correspondeNome &&
      correspondeCategoria &&
      correspondeBio &&
      correspondePreco &&
      correspondeEpoca
    );
  });

  if (filtro.ordenacao === 'preco_asc') {
    filtrados.sort((a, b) =>
      Number(a.preco) - Number(b.preco)
    );
  }

  if (filtro.ordenacao === 'preco_desc') {
    filtrados.sort((a, b) =>
      Number(b.preco) - Number(a.preco)
    );
  }

  if (filtro.ordenacao === 'nome_asc') {
    filtrados.sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt')
    );
  }

  if (filtro.ordenacao === 'recentes') {
    filtrados.sort((a, b) =>
      (Date.parse(b.createdAt) || 0) -
      (Date.parse(a.createdAt) || 0)
    );
  }

  return filtrados;
}

export default function Catalogo() {
  const [produtos, setProdutos] = useState([]);

  const [filtro, setFiltro] = useState({
    ...FILTRO_INICIAL
  });

  const [erro, setErro] = useState('');
  const [aCarregar, setACarregar] = useState(true);

  const carrinho = useCarrinho();
  const { utilizador } = useAuth();

  // =====================================
  // CARREGAR PRODUTOS COM FILTROS
  // =====================================

  useEffect(() => {
    let ativo = true;

    async function carregarProdutos() {
      setACarregar(true);
      setErro('');

      try {
        // Modo com dados simulados
        if (USAR_DADOS_SIMULADOS) {
          const lista = filtrarProdutosSimulados(
            produtosSimulados,
            filtro
          );

          if (ativo) {
            setProdutos(lista);
          }

          return;
        }

        // Construir os filtros para a API
        const parametros = new URLSearchParams();

        if (filtro.q.trim()) {
          parametros.set('q', filtro.q.trim());
        }

        if (filtro.categoria !== 'Todos') {
          parametros.set(
            'categoria',
            filtro.categoria
          );
        }

        if (filtro.bio) {
          parametros.set('bio', 'true');
        }

        if (filtro.precoMax !== '') {
          parametros.set(
            'precoMax',
            filtro.precoMax
          );
        }

        if (filtro.epoca !== 'Todas') {
          parametros.set('epoca', filtro.epoca);
        }

        parametros.set(
          'ordenacao',
          filtro.ordenacao
        );

        // Consultar produtos reais no MongoDB
        const lista = await api(
          `/products?${parametros.toString()}`
        );

        if (ativo) {
          setProdutos(
            Array.isArray(lista) ? lista : []
          );
        }

      } catch (err) {
        if (ativo) {
          setErro(err.message);
          setProdutos([]);
        }

      } finally {
        if (ativo) {
          setACarregar(false);
        }
      }
    }

    carregarProdutos();

    return () => {
      ativo = false;
    };

  }, [filtro]);

  // =====================================
  // ALTERAR FILTROS
  // =====================================

  function mudar(campo) {
    return (e) => {
      const valor = e.target.type === 'checkbox'
        ? e.target.checked
        : e.target.value;

      setFiltro((anterior) => ({
        ...anterior,
        [campo]: valor
      }));
    };
  }

  function limparFiltros() {
    setFiltro({
      ...FILTRO_INICIAL
    });
  }

  // =====================================
  // INTERFACE DO CATÁLOGO
  // =====================================

  return (
    <>
      {/* APRESENTAÇÃO */}
      <section className="destaque mb-4">
        <h1>
          Direto de quem produz, para a sua mesa.
        </h1>

        <p className="texto-secundario">
          Produtores do Alto Minho.
          Encomende ou dispute os lotes da época
          nos leilões em direto.
        </p>
      </section>

      {/* PESQUISA E CATEGORIAS */}
      <section
        className="filtros mb-3"
        aria-label="Pesquisa e categorias"
      >
        <label
          className="visually-hidden"
          htmlFor="pesquisa"
        >
          Pesquisar produtos
        </label>

        <input
          id="pesquisa"
          type="search"
          className="form-control"
          placeholder="Pesquisar kiwi, mel, Alvarinho..."
          value={filtro.q}
          maxLength={100}
          onChange={mudar('q')}
        />

        {/* CATEGORIAS */}
        <div className="d-flex flex-wrap gap-2">
          {CATEGORIAS.map((categoria) => (
            <button
              key={categoria}
              type="button"
              className={`btn btn-sm ${filtro.categoria === categoria
                  ? 'btn-dark'
                  : 'btn-outline-secondary'
                }`}
              onClick={() =>
                setFiltro((anterior) => ({
                  ...anterior,
                  categoria
                }))
              }
            >
              {categoria}
            </button>
          ))}
        </div>

        {/* FILTRO BIOLÓGICO */}
        <div className="form-check">
          <input
            id="bio"
            className="form-check-input"
            type="checkbox"
            checked={filtro.bio}
            onChange={mudar('bio')}
          />

          <label
            className="form-check-label"
            htmlFor="bio"
          >
            Só biológico
          </label>
        </div>
      </section>

      {/* FILTROS AVANÇADOS */}
      <section
        className="mb-4"
        aria-label="Filtros avançados"
      >
        <div className="row g-3 align-items-end">

          {/* PREÇO MÁXIMO */}
          <div className="col-12 col-md-3">
            <label
              htmlFor="precoMax"
              className="form-label"
            >
              Preço máximo (€)
            </label>

            <input
              id="precoMax"
              type="number"
              className="form-control"
              placeholder="Sem limite"
              min="0"
              step="0.01"
              value={filtro.precoMax}
              onChange={mudar('precoMax')}
            />
          </div>

          {/* ÉPOCA */}
          <div className="col-12 col-md-3">
            <label
              htmlFor="epoca"
              className="form-label"
            >
              Época
            </label>

            <select
              id="epoca"
              className="form-select"
              value={filtro.epoca}
              onChange={mudar('epoca')}
            >
              {EPOCAS.map((epoca) => (
                <option key={epoca} value={epoca}>
                  {epoca}
                </option>
              ))}
            </select>
          </div>

          {/* ORDENAÇÃO */}
          <div className="col-12 col-md-4">
            <label
              htmlFor="ordenacao"
              className="form-label"
            >
              Ordenar por
            </label>

            <select
              id="ordenacao"
              className="form-select"
              value={filtro.ordenacao}
              onChange={mudar('ordenacao')}
            >
              <option value="recentes">
                Mais recentes
              </option>

              <option value="preco_asc">
                Preço: mais barato primeiro
              </option>

              <option value="preco_desc">
                Preço: mais caro primeiro
              </option>

              <option value="nome_asc">
                Nome: A a Z
              </option>
            </select>
          </div>

          {/* LIMPAR FILTROS */}
          <div className="col-12 col-md-2">
            <button
              type="button"
              className="btn btn-outline-secondary w-100"
              onClick={limparFiltros}
            >
              Limpar filtros
            </button>
          </div>

        </div>
      </section>

      {/* MENSAGENS */}
      {erro && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {erro}
        </div>
      )}

      {aCarregar && (
        <p className="texto-secundario">
          A carregar produtos...
        </p>
      )}

      {/* RESULTADO DA PESQUISA */}
      {!aCarregar && !erro && (
        <p className="texto-secundario small mb-3">
          {produtos.length}{' '}
          {produtos.length === 1
            ? 'produto encontrado'
            : 'produtos encontrados'}
        </p>
      )}

      {/* CARTÕES DOS PRODUTOS */}
      {!aCarregar && !erro && (
        <section
          className="grelha-produtos"
          aria-label="Produtos"
        >
          {produtos.map((produto) => (
            <CartaoProduto
              key={produto._id}
              produto={produto}
              onAdicionar={
                utilizador?.papel === 'comprador'
                  ? () => carrinho.adicionar(produto)
                  : undefined
              }
            />
          ))}
        </section>
      )}

      {/* SEM RESULTADOS */}
      {!aCarregar &&
        !erro &&
        produtos.length === 0 && (
          <div className="alert alert-info mt-3">
            Nenhum produto encontrado
            com os filtros selecionados.
          </div>
        )}
    </>
  );
}
