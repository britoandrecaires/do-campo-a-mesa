
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { entrar } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [dados, setDados] = useState({
    email: '',
    password: ''
  });

  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [aEntrar, setAEntrar] = useState(false);
  const [erro, setErro] = useState('');

  function alterar(evento) {
    const { name, value } = evento.target;

    setDados((anterior) => ({
      ...anterior,
      [name]: value
    }));
  }

  async function submeter(evento) {
    evento.preventDefault();

    if (aEntrar) return;

    setErro('');
    setAEntrar(true);

    try {
      const utilizador = await entrar(
        dados.email.trim(),
        dados.password
      );

      const destinos = {
        admin: '/admin',
        produtor: '/produtor',
        comprador: '/'
      };

      const destinoPedido = location.state?.de;

      const destino =
        typeof destinoPedido === 'string' &&
          destinoPedido.startsWith('/') &&
          !destinoPedido.startsWith('//')
          ? destinoPedido
          : destinos[utilizador?.papel] || '/';

      navigate(destino, { replace: true });
    } catch (err) {
      setErro(
        err.message || 'Não foi possível iniciar sessão.'
      );
    } finally {
      setAEntrar(false);
    }
  }

  return (
    <section
      className="pagina-login"
      aria-labelledby="titulo-login"
    >
      <div className="login-layout">

        {/* COLUNA DE APRESENTAÇÃO */}
        <aside className="login-destaque">
          <div className="login-destaque-conteudo">



            <h2>
              Do campo à mesa.
              <span>Mais perto de ti.</span>
            </h2>

            <p className="login-descricao">
              Descobre produtos locais, apoia os produtores
              da nossa região e participa em leilões
              em direto.
            </p>

            <div className="login-vantagens">
              <div className="login-vantagem">
                <span aria-hidden="true">✓</span>
                Produtos frescos e regionais
              </div>

              <div className="login-vantagem">
                <span aria-hidden="true">✓</span>
                Ligação direta aos produtores
              </div>

              <div className="login-vantagem">
                <span aria-hidden="true">✓</span>
                Leilões em tempo real
              </div>
            </div>
          </div>

          <p className="login-assinatura">
            Do Campo à Mesa · Alto Minho
          </p>
        </aside>

        {/* COLUNA DO FORMULÁRIO */}
        <div className="login-cartao">

          <div className="login-cabecalho">
            <span className="login-etiqueta">
              ÁREA PESSOAL
            </span>

            <h1 id="titulo-login">
              Bem-vindo de volta!
            </h1>

            <p>
              Entra na tua conta para continuares
              a explorar o mercado.
            </p>
          </div>

          <form onSubmit={submeter}>

            <div className="mb-3">
              <label
                htmlFor="login-email"
                className="form-label fw-semibold"
              >
                Endereço de email
              </label>

              <input
                id="login-email"
                name="email"
                type="email"
                className="form-control"
                placeholder="exemplo@email.com"
                autoComplete="username"
                inputMode="email"
                value={dados.email}
                onChange={alterar}
                disabled={aEntrar}
                required
              />
            </div>

            <div className="mb-3">
              <label
                htmlFor="login-password"
                className="form-label fw-semibold"
              >
                Palavra-passe
              </label>

              <div className="login-password-wrap">
                <input
                  id="login-password"
                  name="password"
                  type={mostrarPassword ? 'text' : 'password'}
                  className="form-control"
                  placeholder="Introduz a tua palavra-passe"
                  autoComplete="current-password"
                  value={dados.password}
                  onChange={alterar}
                  disabled={aEntrar}
                  required
                />

                <button
                  type="button"
                  className="login-mostrar-password"
                  onClick={() =>
                    setMostrarPassword((anterior) => !anterior)
                  }
                  aria-label={
                    mostrarPassword
                      ? 'Ocultar palavra-passe'
                      : 'Mostrar palavra-passe'
                  }
                  aria-pressed={mostrarPassword}
                >
                  {mostrarPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            {erro && (
              <div
                className="alert alert-danger mt-3"
                role="alert"
              >
                {erro}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-success login-botao-entrar w-100"
              disabled={aEntrar}
            >
              {aEntrar ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    aria-hidden="true"
                  />
                  A entrar...
                </>
              ) : (
                'Entrar na minha conta'
              )}
            </button>

          </form>

          <div className="login-registo">
            <span>Ainda não tens conta? </span>
            <Link to="/registo">
              Criar conta
            </Link>
          </div>

          <div className="login-voltar">
            <Link to="/">
              ← Voltar ao catálogo
            </Link>
          </div>

        </div>

      </div>
    </section>
  );
}
