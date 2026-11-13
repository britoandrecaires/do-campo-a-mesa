
import { Link } from 'react-router-dom';

// Formatar preços em euros
const euro = (valor) =>
  Number(valor).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

export default function CartaoProduto({
  produto,
  onAdicionar
}) {
  // Identificar o produtor associado ao produto
  const produtor = produto.produtor;

  // O produtor pode vir como objeto ou apenas ID
  const produtorId =
    typeof produtor === 'object'
      ? produtor?._id
      : produtor;

  const nomeProdutor =
    typeof produtor === 'object'
      ? produtor?.produtor?.nomeExploracao ||
      produtor?.nome ||
      'Produtor local'
      : 'Produtor local';

  const localidade =
    typeof produtor === 'object'
      ? produtor?.produtor?.localidade || ''
      : '';

  return (
    <article className="card cartao-produto h-100">


      {/* IMAGEM DO PRODUTO */}
      {produto.imagemUrl ? (
        <img
          src={produto.imagemUrl}
          className="card-img-top"
          alt={produto.nome}
          loading="lazy"
          style={{
            width: '100%',
            height: '230px',
            objectFit: 'contain',
            objectPosition: 'center',
            backgroundColor: '#ffffff',
            padding: '12px',
            borderBottom: '1px solid #eee'
          }}
        />
      ) : (
        <div
          className="cartao-produto__imagem"
          aria-hidden="true"
          style={{
            width: '100%',
            height: '230px',
            backgroundColor: '#e1e3d9'
          }}
        />
      )}


      <div className="card-body d-flex flex-column">

        {/* IDENTIFICAÇÃO BIOLÓGICA */}
        {produto.biologico && (
          <span className="etiqueta-bio">
            BIO
          </span>
        )}

        {/* NOME DO PRODUTO */}
        <h3 className="h6 mb-1">
          {produto.nome}
        </h3>

        {/* INFORMAÇÕES DO PRODUTOR */}
        <p className="texto-secundario small mb-2">
          {nomeProdutor}
          {localidade && ` · ${localidade}`}
        </p>

        {/* PREÇO */}
        <p className="preco mt-auto">
          {euro(produto.preco)}
          <span className="texto-secundario small">
            {' '}/ {produto.unidade}
          </span>
        </p>

        {/* BOTÕES */}
        <div className="d-grid gap-2">

          {/* VER PERFIL PÚBLICO DO PRODUTOR */}
          {produtorId && (
            <Link
              to={`/produtores/${produtorId}`}
              className="btn btn-outline-success"
            >
              Ver produtor
            </Link>
          )}

          {/* ADICIONAR AO CARRINHO */}
          {onAdicionar && (
            <button
              type="button"
              className="btn btn-success w-100"
              onClick={onAdicionar}
            >
              Adicionar ao carrinho
            </button>
          )}

        </div>

      </div>
    </article>
  );
}
