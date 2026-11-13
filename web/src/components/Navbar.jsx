
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

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
      aria-hidden="true"
      style={{
        width: 38,
        height: 38,
        borderRadius: '50%',
        backgroundColor: '#2e5b3e',
        color: '#fff',
        fontSize: 13,
        fontWeight: 700
      }}
    >
      {iniciais(nome)}
    </span>
  );
}

export default function Navbar() {
  const { utilizador, sair } = useAuth();
  const { linhas } = useCarrinho();
  const { pathname } = useLocation();

  const [menuAberto, setMenuAberto] = useState(false);

  const nome = utilizador?.nome || 'Utilizador';
  const papel = PAPEIS[utilizador?.papel] || 'Utilizador';

  // Fechar automaticamente ao mudar de página
  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);

  function fecharMenu() {
    setMenuAberto(false);
  }

  function terminarSessao() {
    fecharMenu();
    sair();
  }

  return (
    <header className="barra-topo">
      <nav
        className="navbar navbar-expand-lg container-xl"
        aria-label="Navegação principal"
      >
        {/* LOGÓTIPO */}
        <Link
          to="/"
          className="navbar-brand marca"
          onClick={fecharMenu}
        >
          Do Campo à Mesa
        </Link>

        {/* AVATAR NO TELEMÓVEL */}
        {utilizador && (
          <div className="d-lg-none ms-auto me-2">
            <Avatar nome={nome} />
          </div>
        )}

        {/* BOTÃO HAMBÚRGUER */}
        <button
          className="navbar-toggler"
          type="button"
          onClick={() => setMenuAberto((atual) => !atual)}
          aria-controls="menu-principal"
          aria-expanded={menuAberto}
          aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
        >
          <span className="navbar-toggler-icon" />
        </button>

        {/* CONTEÚDO DO MENU */}
        <div
          id="menu-principal"
          className={`collapse navbar-collapse ${menuAberto ? 'show' : ''
            }`}
        >
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <NavLink
                to="/"
                end
                className="nav-link"
                onClick={fecharMenu}
              >
                Produtos
              </NavLink>
            </li>

            <li className="nav-item">
              <NavLink
                to="/leiloes"
                className="nav-link"
                onClick={fecharMenu}
              >
                Leilões
              </NavLink>
            </li>

            {utilizador?.papel === 'comprador' && (
              <li className="nav-item">
                <NavLink
                  to="/encomendas"
                  className="nav-link"
                  onClick={fecharMenu}
                >
                  Encomendas
                </NavLink>
              </li>
            )}

            {utilizador?.papel === 'produtor' && (
              <li className="nav-item">
                <NavLink
                  to="/produtor"
                  className="nav-link"
                  onClick={fecharMenu}
                >
                  Painel
                </NavLink>
              </li>
            )}

            {utilizador?.papel === 'admin' && (
              <li className="nav-item">
                <NavLink
                  to="/admin"
                  className="nav-link"
                  onClick={fecharMenu}
                >
                  Administração
                </NavLink>
              </li>
            )}
          </ul>

          {/* CONTA E AÇÕES */}
          <div className="menu-acoes d-flex flex-wrap align-items-center gap-3 py-2 py-lg-0">

            {utilizador?.papel === 'comprador' && (
              <Link
                to="/carrinho"
                className="btn btn-outline-secondary"
                onClick={fecharMenu}
              >
                Carrinho ({linhas.length})
              </Link>
            )}

            {utilizador ? (
              <>
                <div className="perfil-menu d-flex align-items-center gap-2">

                  {/* Avatar apenas no computador */}
                  <div className="d-none d-lg-block">
                    <Avatar nome={nome} />
                  </div>

                  <div className="d-flex flex-column">
                    <span className="fw-semibold">
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
                  onClick={terminarSessao}
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="btn btn-outline-secondary"
                  onClick={fecharMenu}
                >
                  Entrar
                </Link>

                <Link
                  to="/registo"
                  className="btn btn-success"
                  onClick={fecharMenu}
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
