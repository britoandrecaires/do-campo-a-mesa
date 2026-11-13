
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';

const PAPEIS = {
  comprador: 'Comprador',
  produtor: 'Produtor',
  admin: 'Administrador'
};

function iniciais(nome = '') {
  const partes = nome.trim().split(/\s+/).filter(Boolean);

  if (partes.length === 0) return 'U';

  if (partes.length === 1) {
    return partes[0].slice(0, 2).toUpperCase();
  }

  return (
    partes[0][0] + partes[partes.length - 1][0]
  ).toUpperCase();
}

function Avatar({ nome }) {
  return (
    <span
      className="d-inline-flex align-items-center justify-content-center flex-shrink-0"
      title={nome}
      style={{
        width: 38,
        height: 38,
        borderRadius: '50%',
        backgroundColor: '#2e5b3e',
        color: '#fff',
        fontSize: 13,
        fontWeight: 700
      }}
      aria-hidden="true"
    >
      {iniciais(nome)}
    </span>
  );
}

export default function Navbar() {
  const { utilizador, sair } = useAuth();
  const { linhas } = useCarrinho();

  const nome = utilizador?.nome || 'Utilizador';
  const papel = PAPEIS[utilizador?.papel] || 'Utilizador';

  return (
    <header className="barra-topo">
      <nav
        className="navbar navbar-expand-lg container-xl"
        aria-label="Navegação principal"
      >
        <Link to="/" className="navbar-brand marca">
          Do Campo à Mesa
        </Link>

        {/* Avatar visível no telemóvel */}
        {utilizador && (
          <div className="d-lg-none ms-auto me-2">
            <Avatar nome={nome} />
          </div>
        )}

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#menu"
          aria-controls="menu"
          aria-expanded="false"
          aria-label="Abrir menu"
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse" id="menu">
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <NavLink to="/" end className="nav-link">
                Produtos
              </NavLink>
            </li>

            <li className="nav-item">
              <NavLink to="/leiloes" className="nav-link">
                Leilões
              </NavLink>
            </li>

            {utilizador?.papel === 'comprador' && (
              <li className="nav-item">
                <NavLink to="/encomendas" className="nav-link">
                  Encomendas
                </NavLink>
              </li>
            )}

            {utilizador?.papel === 'produtor' && (
              <li className="nav-item">
                <NavLink to="/produtor" className="nav-link">
                  Painel
                </NavLink>
              </li>
            )}

            {utilizador?.papel === 'admin' && (
              <li className="nav-item">
                <NavLink to="/admin" className="nav-link">
                  Administração
                </NavLink>
              </li>
            )}
          </ul>

          <div className="d-flex flex-wrap align-items-center gap-3 py-2 py-lg-0">
            {utilizador?.papel === 'comprador' && (
              <Link
                to="/carrinho"
                className="btn btn-outline-secondary"
              >
                Carrinho ({linhas.length})
              </Link>
            )}

            {utilizador ? (
              <>
                <div className="d-flex align-items-center gap-2">
                  {/* Evitar duplicar o avatar no telemóvel */}
                  <div className="d-none d-lg-block">
                    <Avatar nome={nome} />
                  </div>

                  <div
                    className="d-flex flex-column"
                    style={{ maxWidth: 180, lineHeight: 1.3 }}
                  >
                    <span
                      className="fw-semibold text-truncate"
                      title={nome}
                    >
                      {nome}
                    </span>
                    <small className="text-muted">
                      {papel}
                    </small>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={sair}
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="btn btn-outline-secondary"
                >
                  Entrar
                </Link>

                <Link
                  to="/registo"
                  className="btn btn-success"
                >
                  Registar
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
