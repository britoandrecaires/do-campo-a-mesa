
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

// Converter uma data para o formato datetime-local
function formatarDataLocal(data) {
  const doisDigitos = (n) => String(n).padStart(2, '0');

  return [
    data.getFullYear(),
    doisDigitos(data.getMonth() + 1),
    doisDigitos(data.getDate())
  ].join('-') + 'T' + [
    doisDigitos(data.getHours()),
    doisDigitos(data.getMinutes())
  ].join(':');
}

function formularioInicial() {
  const agora = new Date();

  return {
    lote: '',
    descricao: '',
    quantidade: '',
    precoBase: '',
    incremento: '5',
    iniciaEm: formatarDataLocal(
      new Date(agora.getTime() - 60000)
    ),
    terminaEm: formatarDataLocal(
      new Date(agora.getTime() + 3600000)
    )
  };
}

export default function NovoLeilao() {
  const { token } = useAuth();

  const [form, setForm] = useState(formularioInicial);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [leilaoCriado, setLeilaoCriado] = useState(null);
  const [aGuardar, setAGuardar] = useState(false);

  function alterar(e) {
    const { name, value } = e.target;

    setForm((anterior) => ({
      ...anterior,
      [name]: value
    }));
  }

  async function criarLeilao(e) {
    e.preventDefault();

    setErro('');
    setSucesso('');
    setAGuardar(true);

    try {
      const precoBase = Number(form.precoBase);
      const incremento = Number(form.incremento);

      const inicio = new Date(form.iniciaEm);
      const fim = new Date(form.terminaEm);

      // Validar os valores
      if (!form.lote.trim()) {
        throw new Error('Indica o nome do lote.');
      }

      if (!Number.isFinite(precoBase) || precoBase <= 0) {
        throw new Error('O preço inicial deve ser positivo.');
      }

      if (!Number.isFinite(incremento) || incremento < 0.01) {
        throw new Error('O incremento mínimo deve ser positivo.');
      }

      if (
        !Number.isFinite(inicio.getTime()) ||
        !Number.isFinite(fim.getTime()) ||
        fim <= inicio ||
        fim <= new Date()
      ) {
        throw new Error(
          'A data de fim deve ser posterior ao início e ao momento atual.'
        );
      }

      // Enviar os dados para a API
      const novo = await api('/auctions', {
        metodo: 'POST',
        token,
        corpo: {
          lote: form.lote.trim(),
          descricao: form.descricao.trim(),
          quantidade: form.quantidade.trim(),
          precoBase,
          incremento,
          iniciaEm: inicio.toISOString(),
          terminaEm: fim.toISOString()
        }
      });

      setLeilaoCriado(novo);
      setSucesso('Leilão criado com sucesso!');

    } catch (err) {
      setErro(err.message);
    } finally {
      setAGuardar(false);
    }
  }

  function criarOutro() {
    setForm(formularioInicial());
    setErro('');
    setSucesso('');
    setLeilaoCriado(null);
  }

  return (
    <div className="container py-4">
      <div className="mb-4">
        <Link
          to="/produtor"
          className="btn btn-outline-secondary mb-3"
        >
          Voltar ao painel
        </Link>

        <h1>Criar novo leilão</h1>

        <p className="text-muted">
          Coloca um lote à venda e permite que
          os compradores façam licitações em direto.
        </p>
      </div>

      {erro && (
        <div className="alert alert-danger" role="alert">
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="alert alert-success" role="status">
          <h2 className="h5">{sucesso}</h2>

          <p className="mb-2">
            O leilão foi guardado no MongoDB Atlas.
          </p>

          <div className="d-flex flex-wrap gap-2">
            <Link to="/leiloes" className="btn btn-success">
              Ver leilões
            </Link>

            <button
              type="button"
              className="btn btn-outline-success"
              onClick={criarOutro}
            >
              Criar outro leilão
            </button>
          </div>


        </div>
      )}

      <section className="card shadow-sm">
        <div className="card-body p-4">
          <h2 className="h4 mb-4">
            Informações do lote
          </h2>

          <form onSubmit={criarLeilao}>
            <div className="row g-3">

              <div className="col-12">
                <label
                  htmlFor="lote"
                  className="form-label"
                >
                  Nome do lote
                </label>

                <input
                  id="lote"
                  name="lote"
                  type="text"
                  maxLength={150}
                  className="form-control"
                  placeholder="Ex.: 100 kg de Kiwi Hayward"
                  value={form.lote}
                  onChange={alterar}
                  required
                />
              </div>

              <div className="col-12">
                <label
                  htmlFor="descricao"
                  className="form-label"
                >
                  Descrição
                </label>

                <textarea
                  id="descricao"
                  name="descricao"
                  rows={3}
                  maxLength={1000}
                  className="form-control"
                  placeholder="Descreve o lote e as suas características"
                  value={form.descricao}
                  onChange={alterar}
                />
              </div>

              <div className="col-md-6">
                <label
                  htmlFor="quantidade"
                  className="form-label"
                >
                  Quantidade
                </label>

                <input
                  id="quantidade"
                  name="quantidade"
                  className="form-control"
                  placeholder="Ex.: 100 kg"
                  value={form.quantidade}
                  onChange={alterar}
                  required
                />
              </div>

              <div className="col-md-3">
                <label
                  htmlFor="precoBase"
                  className="form-label"
                >
                  Preço inicial (€)
                </label>

                <input
                  id="precoBase"
                  name="precoBase"
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="form-control"
                  placeholder="100.00"
                  value={form.precoBase}
                  onChange={alterar}
                  required
                />
              </div>

              <div className="col-md-3">
                <label
                  htmlFor="incremento"
                  className="form-label"
                >
                  Incremento mínimo (€)
                </label>

                <input
                  id="incremento"
                  name="incremento"
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="form-control"
                  value={form.incremento}
                  onChange={alterar}
                  required
                />
              </div>

              <div className="col-md-6">
                <label
                  htmlFor="iniciaEm"
                  className="form-label"
                >
                  Data e hora de início
                </label>

                <input
                  id="iniciaEm"
                  name="iniciaEm"
                  type="datetime-local"
                  className="form-control"
                  value={form.iniciaEm}
                  onChange={alterar}
                  required
                />
              </div>

              <div className="col-md-6">
                <label
                  htmlFor="terminaEm"
                  className="form-label"
                >
                  Data e hora de fim
                </label>

                <input
                  id="terminaEm"
                  name="terminaEm"
                  type="datetime-local"
                  className="form-control"
                  value={form.terminaEm}
                  onChange={alterar}
                  required
                />
              </div>

            </div>

            <div className="alert alert-info mt-4">
              O leilão ficará ativo imediatamente se a
              data de início já tiver passado e a de fim
              ainda não tiver chegado.
            </div>

            <div className="d-flex gap-2 mt-4">
              <button
                type="submit"
                className="btn btn-success"
                disabled={aGuardar || !!leilaoCriado}
              >
                {aGuardar
                  ? 'A criar leilão...'
                  : 'Criar leilão'}
              </button>

              <Link
                to="/produtor"
                className="btn btn-outline-secondary"
              >
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
