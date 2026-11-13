
import { useState } from 'react';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';

export default function Carrinho() {
  const {
    linhas,
    remover,
    alterarQuantidade,
    removerVarios,
    total
  } = useCarrinho();

  const { token } = useAuth();

  const [tipoEntrega, setTipoEntrega] = useState('levantamento');
  const [morada, setMorada] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [aEnviar, setAEnviar] = useState(false);

  // Agrupar produtos pelo respetivo produtor
  const grupos = Object.values(
    linhas.reduce((acc, linha) => {
      const produtor = linha.produto.produtor;
      const id = String(produtor?._id || produtor);

      if (!acc[id]) {
        acc[id] = {
          id,
          nome: produtor?.produtor?.nomeExploracao ||
            produtor?.nome ||
            'Produtor',
          linhas: []
        };
      }

      acc[id].linhas.push(linha);
      return acc;
    }, {})
  );

  async function confirmarEncomenda(e) {
    e.preventDefault();
    setErro('');
    setSucesso('');

    if (linhas.length === 0) {
      setErro('O carrinho está vazio.');
      return;
    }

    if (!token) {
      setErro('Inicia sessão para confirmar a encomenda.');
      return;
    }

    if (tipoEntrega === 'entrega' && !morada.trim()) {
      setErro('Introduz a morada de entrega.');
      return;
    }

    setAEnviar(true);
    let confirmadas = 0;

    try {
      // Cada produtor recebe a sua própria encomenda
      for (const grupo of grupos) {
        const produtos = grupo.linhas.map((linha) => ({
          produto: linha.produto._id,
          quantidade: linha.quantidade
        }));

        await api('/orders', {
          metodo: 'POST',
          token,
          corpo: {
            linhas: produtos,
            entrega: {
              tipo: tipoEntrega,
              morada: tipoEntrega === 'entrega'
                ? morada.trim()
                : ''
            }
          }
        });

        confirmadas++;

        // Só retirar produtos cuja encomenda foi criada
        removerVarios(
          grupo.linhas.map((linha) => linha.produto._id)
        );
      }

      setSucesso(
        `${confirmadas} encomenda(s) confirmada(s) com sucesso!`
      );

    } catch (err) {
      setErro(
        `Não foi possível concluir todas as encomendas: ${err.message}` +
        (confirmadas > 0
          ? ` (${confirmadas} já confirmada(s)).`
          : '')
      );
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <>
      <h1 className="mb-4">Carrinho</h1>

      {erro && (
        <div className="alert alert-danger">
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="alert alert-success">
          {sucesso}
        </div>
      )}

      {linhas.length === 0 && (
        <p>O carrinho está vazio.</p>
      )}

      {grupos.map((grupo) => (
        <section className="card mb-3" key={grupo.id}>
          <div className="card-body">
            <h2 className="h5 mb-3">
              {grupo.nome}
            </h2>

            {grupo.linhas.map(({ produto, quantidade }) => (
              <div
                className="d-flex justify-content-between align-items-center gap-3 mb-3"
                key={produto._id}
              >
                <div>
                  <strong>{produto.nome}</strong>
                  <p className="mb-1 text-muted">
                    {Number(produto.preco).toFixed(2)} €
                    {' / '}{produto.unidade}
                  </p>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    aria-label={`Quantidade de ${produto.nome}`}
                    className="form-control"
                    style={{ width: '75px' }}
                    value={quantidade}
                    disabled={aEnviar}
                    onChange={(e) =>
                      alterarQuantidade(
                        produto._id,
                        Number(e.target.value)
                      )
                    }
                  />

                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    disabled={aEnviar}
                    onClick={() => remover(produto._id)}
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <h3 className="h5 mb-4">
        Total: {total.toFixed(2)} €
      </h3>

      {linhas.length > 0 && (
        <section className="card">
          <div className="card-body">
            <h2 className="h4 mb-3">
              Finalizar encomenda
            </h2>

            <form onSubmit={confirmarEncomenda}>
              <label
                htmlFor="tipoEntrega"
                className="form-label"
              >
                Método de entrega
              </label>

              <select
                id="tipoEntrega"
                className="form-select mb-3"
                value={tipoEntrega}
                disabled={aEnviar}
                onChange={(e) =>
                  setTipoEntrega(e.target.value)
                }
              >
                <option value="levantamento">
                  Levantamento no produtor
                </option>
                <option value="entrega">
                  Entrega ao domicílio
                </option>
              </select>

              {tipoEntrega === 'entrega' && (
                <div className="mb-3">
                  <label
                    htmlFor="morada"
                    className="form-label"
                  >
                    Morada de entrega
                  </label>

                  <textarea
                    id="morada"
                    className="form-control"
                    rows="3"
                    value={morada}
                    onChange={(e) =>
                      setMorada(e.target.value)
                    }
                    required
                  />
                </div>
              )}

              <p className="text-muted small">
                Será criada uma encomenda por produtor.
                O stock será validado no servidor.
              </p>

              <button
                type="submit"
                className="btn btn-success w-100"
                disabled={aEnviar}
              >
                {aEnviar
                  ? 'A confirmar...'
                  : 'Confirmar encomenda'}
              </button>
            </form>
          </div>
        </section>
      )}
    </>
  );
}
