
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

export default function Registo() {
  const [dados, setDados] = useState({
    nome: '',
    email: '',
    password: '',
    papel: 'comprador',
    nomeExploracao: '',
    localidade: ''
  });

  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [aEnviar, setAEnviar] = useState(false);

  function alterar(e) {
    const { name, value } = e.target;

    setDados((anterior) => ({
      ...anterior,
      [name]: value
    }));
  }

  async function submeter(e) {
    e.preventDefault();
    setErro('');
    setSucesso('');
    setAEnviar(true);

    try {
      await api('/auth/registo', {
        metodo: 'POST',
        corpo: dados
      });

      setSucesso(
        dados.papel === 'produtor'
          ? 'Conta criada! Aguarda aprovação do administrador.'
          : 'Conta criada com sucesso! Já podes iniciar sessão.'
      );

    } catch (err) {
      setErro(err.message);
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <form
      className="formulario-estreito"
      onSubmit={submeter}
    >
      <h1 className="mb-4">Criar conta</h1>

      {erro && (
        <div className="alert alert-danger">{erro}</div>
      )}

      {sucesso && (
        <div className="alert alert-success">
          <p>{sucesso}</p>
          <Link to="/login">Ir para o login</Link>
        </div>
      )}

      <label htmlFor="nome" className="form-label">
        Nome completo
      </label>
      <input
        id="nome"
        name="nome"
        className="form-control mb-3"
        value={dados.nome}
        onChange={alterar}
        required
      />

      <label htmlFor="email" className="form-label">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        className="form-control mb-3"
        value={dados.email}
        onChange={alterar}
        required
      />

      <label htmlFor="password" className="form-label">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        className="form-control mb-3"
        minLength={8}
        value={dados.password}
        onChange={alterar}
        required
      />

      <label htmlFor="papel" className="form-label">
        Tipo de conta
      </label>
      <select
        id="papel"
        name="papel"
        className="form-select mb-3"
        value={dados.papel}
        onChange={alterar}
      >
        <option value="comprador">Comprador</option>
        <option value="produtor">Produtor</option>
      </select>

      {dados.papel === 'produtor' && (
        <>
          <label
            htmlFor="nomeExploracao"
            className="form-label"
          >
            Nome da exploração
          </label>
          <input
            id="nomeExploracao"
            name="nomeExploracao"
            className="form-control mb-3"
            value={dados.nomeExploracao}
            onChange={alterar}
            required
          />

          <label
            htmlFor="localidade"
            className="form-label"
          >
            Localidade
          </label>
          <input
            id="localidade"
            name="localidade"
            className="form-control mb-3"
            value={dados.localidade}
            onChange={alterar}
            required
          />
        </>
      )}

      <button
        type="submit"
        className="btn btn-success w-100"
        disabled={aEnviar}
      >
        {aEnviar ? 'A registar...' : 'Criar conta'}
      </button>
    </form>
  );
}
