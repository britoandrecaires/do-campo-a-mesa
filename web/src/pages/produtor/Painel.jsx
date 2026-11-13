// Painel do produtor — produtos, fotografias e encomendas
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, API_URL } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
const formularioInicial = {
  nome: '',
  categoria: 'Fruta',
  preco: '',
  unidade: 'kg',
  stock: '',
  biologico: false,
  epocas: []
};
const proximosEstados = {
  pendente: 'confirmada',
  confirmada: 'pronta',
  pronta: 'entregue'
};
const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp'];
const LIMITE_IMAGEM = 5 * 1024 * 1024;
const EPOCAS = ['Primavera', 'Verão', 'Outono', 'Inverno'];
export default function PainelProdutor() {
  const { token } = useAuth();
  const [produtos, setProdutos] = useState([]);
  const [form, setForm] = useState({ ...formularioInicial });
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [aGuardar, setAGuardar] = useState(false);
  const [aCarregar, setACarregar] = useState(true);
  const [editarId, setEditarId] = useState(null);
  const [eliminarId, setEliminarId] = useState(null);
  // Fotografia opcional no formulário de criação/edição.
  const [imagemFormulario, setImagemFormulario] = useState(null);
  const [chaveInputImagem, setChaveInputImagem] = useState(0);
  // Estado próprio do upload: não interfere com o formulário de produtos.
  const [ficheiros, setFicheiros] = useState({});
  const [aEnviarImagem, setAEnviarImagem] = useState(null);
  const [encomendas, setEncomendas] = useState([]);
  const [aCarregarEncomendas, setACarregarEncomendas] = useState(true);
  const [aAtualizarEncomenda, setAAtualizarEncomenda] = useState(null);
  // Indicadores devolvidos pelo endpoint protegido do produtor.
  const [estatisticas, setEstatisticas] = useState(null);
  const [aCarregarEstatisticas, setACarregarEstatisticas] = useState(true);
  const [erroEstatisticas, setErroEstatisticas] = useState('');
  const [versaoEstatisticas, setVersaoEstatisticas] = useState(0);
  // Listar apenas os produtos do produtor autenticado.
  useEffect(() => {
    let ativo = true;
    api('/products/meus', { token })
      .then((lista) => {
        if (ativo) setProdutos(lista);
      })
      .catch((err) => {
        if (ativo) setErro(err.message);
      })
      .finally(() => {
        if (ativo) setACarregar(false);
      });
    return () => { ativo = false; };
  }, [token]);
  // Listar encomendas recebidas por este produtor.
  useEffect(() => {
    let ativo = true;
    api('/orders', { token })
      .then((lista) => {
        if (ativo) setEncomendas(lista);
      })
      .catch((err) => {
        if (ativo) setErro(err.message);
      })
      .finally(() => {
        if (ativo) setACarregarEncomendas(false);
      });
    return () => { ativo = false; };
  }, [token]);
  // Atualizar os indicadores ao entrar e depois de alterações relevantes.
  useEffect(() => {
    let ativo = true;
    if (!token) {
      setEstatisticas(null);
      setACarregarEstatisticas(false);
      return () => { ativo = false; };
    }
    setACarregarEstatisticas(true);
    setErroEstatisticas('');
    api('/products/estatisticas', { token })
      .then((dados) => {
        if (ativo) setEstatisticas(dados);
      })
      .catch((err) => {
        if (ativo) setErroEstatisticas(err.message);
      })
      .finally(() => {
        if (ativo) setACarregarEstatisticas(false);
      });
    return () => { ativo = false; };
  }, [token, versaoEstatisticas]);
  function alterar(e) {
    const { name, value, type, checked } = e.target;
    setForm((anterior) => ({
      ...anterior,
      [name]: type === 'checkbox' ? checked : value
    }));
  }
  // Selecionar uma ou várias épocas (gravadas como array em MongoDB).
  function alternarEpoca(epoca) {
    setForm((anterior) => ({
      ...anterior,
      epocas: anterior.epocas.includes(epoca)
        ? anterior.epocas.filter((e) => e !== epoca)
        : [...anterior.epocas, epoca]
    }));
  }
  function alternarTodoAno() {
    setForm((anterior) => ({
      ...anterior,
      epocas: anterior.epocas.length === EPOCAS.length ? [] : [...EPOCAS]
    }));
  }
  function iniciarEdicao(produto) {
    setEditarId(produto._id);
    setImagemFormulario(null);
    setChaveInputImagem((chave) => chave + 1);
    setForm({
      nome: produto.nome,
      categoria: produto.categoria,
      preco: String(produto.preco),
      unidade: produto.unidade || 'kg',
      stock: String(produto.stock),
      biologico: Boolean(produto.biologico),
      epocas: Array.isArray(produto.epocas) ? [...produto.epocas] : []
    });
    setErro('');
    setSucesso('');
  }
  function cancelarEdicao() {
    setEditarId(null);
    setForm({ ...formularioInicial });
    setImagemFormulario(null);
    setChaveInputImagem((chave) => chave + 1);
  }
  // Validação no frontend. O backend valida novamente por segurança.
  function validarFicheiroImagem(ficheiro) {
    if (!TIPOS_IMAGEM.includes(ficheiro.type)) {
      return 'Escolhe uma imagem JPG, PNG ou WebP.';
    }
    if (ficheiro.size === 0 || ficheiro.size > LIMITE_IMAGEM) {
      return 'A fotografia deve ter até 5 MB e não pode estar vazia.';
    }
    return '';
  }
  function escolherImagemFormulario(e) {
    const ficheiro = e.target.files?.[0] || null;
    setErro('');
    setSucesso('');
    if (!ficheiro) {
      setImagemFormulario(null);
      return;
    }
    const mensagem = validarFicheiroImagem(ficheiro);
    if (mensagem) {
      setImagemFormulario(null);
      setErro(mensagem);
      e.target.value = '';
      return;
    }
    setImagemFormulario(ficheiro);
  }
  // O produto deve existir primeiro para receber a imagem por ID.
  // Este método é usado tanto ao criar/editar como em "Os meus produtos".
  async function guardarImagemDoProduto(produtoId, ficheiro) {
    const dados = new FormData();
    dados.append('imagem', ficheiro);
    const base = API_URL.replace(/\/$/, '');
    const resposta = await fetch(
      `${base}/api/products/${encodeURIComponent(produtoId)}/imagem`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: dados
      }
    );
    // Não definir Content-Type: o browser cria o boundary de multipart.
    const resultado = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      throw new Error(
        resultado.erro || `Falha ao enviar fotografia (${resposta.status}).`
      );
    }
    if (!resultado.imagemUrl) {
      throw new Error('A API não devolveu o endereço da fotografia.');
    }
    return resultado.imagemUrl;
  }
  async function guardarProduto(e) {
    e.preventDefault();
    if (aGuardar) return;
    setErro('');
    setSucesso('');
    if (form.epocas.length === 0) {
      setErro('Seleciona pelo menos uma época. Para todo o ano, seleciona as quatro.');
      return;
    }
    setAGuardar(true);
    try {
      const corpo = {
        ...form,
        preco: Number(form.preco),
        stock: Number(form.stock)
      };
      const estavaAEditar = Boolean(editarId);
      let produtoGuardado;
      // 1. Criar ou atualizar os dados do produto como já fazíamos.
      if (estavaAEditar) {
        produtoGuardado = await api(`/products/${editarId}`, {
          metodo: 'PUT', token, corpo
        });
        setProdutos((lista) => lista.map((p) =>
          p._id === editarId ? produtoGuardado : p
        ));
      } else {
        produtoGuardado = await api('/products', {
          metodo: 'POST', token, corpo
        });
        setProdutos((lista) => [produtoGuardado, ...lista]);
      }
      // 2. Caso o produtor tenha escolhido fotografia, enviar agora.
      // Se falhar, o produto continua guardado e não deve ser criado outra vez.
      if (imagemFormulario) {
        try {
          const imagemUrl = await guardarImagemDoProduto(
            produtoGuardado._id,
            imagemFormulario
          );
          setProdutos((lista) => lista.map((p) =>
            p._id === produtoGuardado._id
              ? { ...p, imagemUrl }
              : p
          ));
          setSucesso(estavaAEditar
            ? 'Produto e fotografia atualizados com sucesso!'
            : 'Produto e fotografia criados com sucesso!'
          );
        } catch (err) {
          setSucesso(estavaAEditar
            ? 'Produto atualizado, mas não foi possível guardar a fotografia.'
            : 'Produto criado, mas não foi possível guardar a fotografia.'
          );
          setErro(`${err.message} Tenta enviar a fotografia em "Os meus produtos".`);
        }
      } else {
        setSucesso(estavaAEditar
          ? 'Produto atualizado com sucesso!'
          : 'Produto criado com sucesso! Podes adicionar uma fotografia quando quiseres.'
        );
      }
      cancelarEdicao();
      setVersaoEstatisticas((v) => v + 1);
    } catch (err) {
      // Apenas os erros de criação/edição são tratados aqui.
      setErro(err.message);
    } finally {
      setAGuardar(false);
    }
  }
  async function eliminarProduto(produto) {
    const confirmar = window.confirm(
      `Tens a certeza que queres eliminar "${produto.nome}"?`
    );
    if (!confirmar) return;
    setErro('');
    setSucesso('');
    setEliminarId(produto._id);
    try {
      await api(`/products/${produto._id}`, {
        metodo: 'DELETE', token
      });
      setProdutos((lista) => lista.filter((p) => p._id !== produto._id));
      setFicheiros((anterior) => {
        const novos = { ...anterior };
        delete novos[produto._id];
        return novos;
      });
      if (editarId === produto._id) cancelarEdicao();
      setSucesso('Produto eliminado com sucesso!');
      setVersaoEstatisticas((v) => v + 1);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEliminarId(null);
    }
  }
  // Selecionar fotografia de um produto já existente.
  function escolherImagem(produtoId, e) {
    const ficheiro = e.target.files?.[0] || null;
    setErro('');
    setSucesso('');
    if (!ficheiro) {
      setFicheiros((anterior) => ({ ...anterior, [produtoId]: null }));
      return;
    }
    const mensagem = validarFicheiroImagem(ficheiro);
    if (mensagem) {
      setFicheiros((anterior) => ({ ...anterior, [produtoId]: null }));
      setErro(mensagem);
      e.target.value = '';
      return;
    }
    setFicheiros((anterior) => ({ ...anterior, [produtoId]: ficheiro }));
  }
  // Upload independente para substituir fotografias nos cartões.
  async function enviarImagem(e, produto) {
    e.preventDefault();
    const ficheiro = ficheiros[produto._id];
    if (!ficheiro || aEnviarImagem) return;
    setErro('');
    setSucesso('');
    setAEnviarImagem(produto._id);
    try {
      const imagemUrl = await guardarImagemDoProduto(produto._id, ficheiro);
      setProdutos((lista) => lista.map((p) =>
        p._id === produto._id ? { ...p, imagemUrl } : p
      ));
      setFicheiros((anterior) => ({ ...anterior, [produto._id]: null }));
      setSucesso(`Fotografia de "${produto.nome}" guardada com sucesso!`);
    } catch (err) {
      setErro(err.message);
    } finally {
      setAEnviarImagem(null);
    }
  }
  async function atualizarEstado(encomenda) {
    const novoEstado = proximosEstados[encomenda.estado];
    if (!novoEstado) return;
    setAAtualizarEncomenda(encomenda._id);
    setErro('');
    setSucesso('');
    try {
      const atualizada = await api(`/orders/${encomenda._id}/estado`, {
        metodo: 'PATCH',
        token,
        corpo: { estado: novoEstado }
      });
      setEncomendas((lista) => lista.map((o) =>
        o._id === atualizada._id
          ? { ...o, estado: atualizada.estado }
          : o
      ));
      setSucesso('Estado da encomenda atualizado!');
      setVersaoEstatisticas((v) => v + 1);
    } catch (err) {
      setErro(err.message);
    } finally {
      setAAtualizarEncomenda(null);
    }
  }
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4 gap-3">
        <h1>Painel do produtor</h1>
        <Link to="/produtor/leiloes/novo" className="btn btn-success">
          Criar leilão
        </Link>
      </div>
      {erro && <div className="alert alert-danger" role="alert">{erro}</div>}
      {sucesso && <div className="alert alert-success" role="status">{sucesso}</div>}
      {/* RESUMO DE ATIVIDADE DO PRODUTOR */}
      <section className="mb-4" aria-labelledby="titulo-estatisticas">
        <h2 id="titulo-estatisticas" className="h4 mb-3">Resumo da atividade</h2>
        {aCarregarEstatisticas && <p>A carregar estatísticas...</p>}
        {erroEstatisticas && (
          <div className="alert alert-warning" role="alert">
            Não foi possível carregar as estatísticas: {erroEstatisticas}
          </div>
        )}
        {!aCarregarEstatisticas && !erroEstatisticas && estatisticas && (
          <>
            <div className="row g-3 mb-3">
              {[
                { titulo: 'Produtos registados', valor: estatisticas.totalProdutos ?? 0 },
                { titulo: 'Encomendas recebidas', valor: estatisticas.totalEncomendas ?? 0 },
                {
                  titulo: 'Valor de encomendas entregues',
                  valor: Number(estatisticas.valorEncomendasEntregues || 0)
                    .toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
                },
                { titulo: 'Produtos com stock baixo', valor: estatisticas.produtosStockBaixo ?? 0 }
              ].map((item) => (
                <div key={item.titulo} className="col-6 col-lg-3">
                  <article className="card h-100 shadow-sm">
                    <div className="card-body">
                      <p className="text-muted small mb-2">{item.titulo}</p>
                      <h3 className="h4 fw-bold mb-0">{item.valor}</h3>
                    </div>
                  </article>
                </div>
              ))}
            </div>
            <div className="card mb-3">
              <div className="card-body">
                <h3 className="h6 mb-3">Encomendas por estado</h3>
                <div className="row g-2">
                  {['pendente', 'confirmada', 'pronta', 'entregue'].map((estado) => (
                    <div className="col-6 col-md-3" key={estado}>
                      <div className="border rounded p-2 h-100">
                        <span className="text-capitalize text-muted small d-block">{estado}</span>
                        <strong>{estatisticas.encomendasPorEstado?.[estado] ?? 0}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {(estatisticas.listaStockBaixo?.length || 0) > 0 ? (
              <div className="alert alert-warning" role="status">
                <h3 className="h6">Produtos com stock baixo (até {estatisticas.limiteStockBaixo ?? 10})</h3>
                <ul className="mb-0">
                  {estatisticas.listaStockBaixo.map((p) => (
                    <li key={p._id}>
                      {p.nome}: <strong>{p.stock} {p.unidade || 'unid.'}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-muted small">
                Sem alertas de stock baixo neste momento.
              </p>
            )}
            <p className="text-muted small">
              O valor das encomendas entregues não representa pagamentos confirmados.
            </p>
          </>
        )}
      </section>
      <section className="card mb-4">
        <div className="card-body">
          <h2 className="h4 mb-3">{editarId ? 'Editar produto' : 'Adicionar produto'}</h2>
          <form onSubmit={guardarProduto}>
            <div className="row g-3">
              <div className="col-md-6">
                <label htmlFor="nome" className="form-label">Nome do produto</label>
                <input id="nome" name="nome" className="form-control"
                  value={form.nome} onChange={alterar} required />
              </div>
              <div className="col-md-6">
                <label htmlFor="categoria" className="form-label">Categoria</label>
                <select id="categoria" name="categoria" className="form-select"
                  value={form.categoria} onChange={alterar}>
                  {['Hortícolas', 'Fruta', 'Mel', 'Vinho', 'Queijo', 'Padaria', 'Outros']
                    .map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-md-4">
                <label htmlFor="preco" className="form-label">Preço (€)</label>
                <input id="preco" name="preco" type="number" step="0.01" min="0"
                  className="form-control" value={form.preco} onChange={alterar} required />
              </div>
              <div className="col-md-4">
                <label htmlFor="unidade" className="form-label">Unidade</label>
                <input id="unidade" name="unidade" className="form-control"
                  value={form.unidade} onChange={alterar} required />
              </div>
              <div className="col-md-4">
                <label htmlFor="stock" className="form-label">Stock</label>
                <input id="stock" name="stock" type="number" min="0" step="1"
                  className="form-control" value={form.stock} onChange={alterar} required />
              </div>
              <div className="col-12">
                <div className="form-check">
                  <input id="biologico" name="biologico" type="checkbox"
                    className="form-check-input" checked={form.biologico} onChange={alterar} />
                  <label htmlFor="biologico" className="form-check-label">
                    Produto biológico
                  </label>
                </div>
              </div>
              {/* ÉPOCAS DO PRODUTO: permite uma ou várias */}
              <div className="col-12">
                <fieldset className="border rounded p-3">
                  <legend className="float-none w-auto px-2 fs-6 fw-semibold mb-2">
                    Épocas do produto
                  </legend>
                  <p className="text-muted small mb-2">
                    Seleciona as estações em que o produto está disponível.
                    Para produtos disponíveis durante todo o ano, marca as quatro.
                  </p>
                  <div className="row g-2">
                    {EPOCAS.map((epoca) => (
                      <div className="col-6 col-md-3" key={epoca}>
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`epoca-${epoca}`}
                            checked={form.epocas.includes(epoca)}
                            onChange={() => alternarEpoca(epoca)}
                            disabled={aGuardar}
                          />
                          <label className="form-check-label" htmlFor={`epoca-${epoca}`}>
                            {epoca}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-success mt-2"
                    onClick={alternarTodoAno}
                    disabled={aGuardar}
                  >
                    {form.epocas.length === EPOCAS.length
                      ? 'Desmarcar todas'
                      : 'Selecionar todo o ano'}
                  </button>
                </fieldset>
              </div>
              <div className="col-12">
                <label htmlFor="fotografia-formulario" className="form-label fw-semibold">
                  {editarId ? 'Nova fotografia (opcional)' : 'Fotografia do produto (opcional)'}
                </label>
                <input
                  key={chaveInputImagem}
                  id="fotografia-formulario"
                  type="file"
                  className="form-control"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={escolherImagemFormulario}
                  disabled={aGuardar}
                />
                <small className="text-muted d-block mt-1">
                  JPG, PNG ou WebP — máximo 5 MB. Podes adicionar a fotografia mais tarde.
                </small>
                {imagemFormulario && (
                  <small className="text-success d-block mt-1">
                    Selecionada: {imagemFormulario.name}
                  </small>
                )}
              </div>
            </div>
            <div className="d-flex gap-2 mt-4">
              <button type="submit" className="btn btn-success" disabled={aGuardar}>
                {aGuardar ? 'A guardar...' : editarId ? 'Guardar alterações' : 'Adicionar produto'}
              </button>
              {editarId && (
                <button type="button" className="btn btn-outline-secondary"
                  onClick={cancelarEdicao} disabled={aGuardar}>
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      </section>
      <section>
        <h2 className="h4 mb-3">Os meus produtos</h2>
        {aCarregar && <p>A carregar produtos...</p>}
        {!aCarregar && produtos.length === 0 && <p>Ainda não tens produtos registados.</p>}
        <div className="row g-3">
          {produtos.map((p) => (
            <div className="col-md-4" key={p._id}>
              <article className="card h-100">
                {p.imagemUrl && (
                  <img
                    src={p.imagemUrl}
                    alt={p.nome}
                    className="card-img-top"
                    style={{ width: '100%', height: 180, objectFit: 'cover' }}
                  />
                )}
                <div className="card-body d-flex flex-column">
                  <h3 className="h5">{p.nome}</h3>
                  <p>{p.categoria}</p>
                  <p><strong>{Number(p.preco).toFixed(2)} €</strong> / {p.unidade}</p>
                  <p>Stock: {p.stock}</p>
                  <p className="text-muted small mb-2">
                    Épocas: {Array.isArray(p.epocas) && p.epocas.length
                      ? (p.epocas.length === EPOCAS.length
                        ? 'Todo o ano'
                        : p.epocas.join(', '))
                      : 'Não definidas'}
                  </p>
                  {p.biologico && <span className="badge bg-success align-self-start">BIO</span>}
                  <div className="d-flex flex-wrap gap-2 mt-3">
                    <button type="button" className="btn btn-outline-primary btn-sm"
                      onClick={() => iniciarEdicao(p)}>Editar</button>
                    <button type="button" className="btn btn-outline-danger btn-sm"
                      disabled={eliminarId !== null || aEnviarImagem === p._id}
                      onClick={() => eliminarProduto(p)}>
                      {eliminarId === p._id ? 'A eliminar...' : 'Eliminar'}
                    </button>
                  </div>
                  <form className="border-top mt-3 pt-3" onSubmit={(e) => enviarImagem(e, p)}>
                    <label htmlFor={`imagem-${p._id}`} className="form-label fw-semibold">
                      {p.imagemUrl ? 'Substituir fotografia' : 'Carregar fotografia'}
                    </label>
                    <input
                      key={`${p._id}-${p.imagemUrl || 'sem-imagem'}`}
                      id={`imagem-${p._id}`}
                      type="file"
                      className="form-control form-control-sm"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => escolherImagem(p._id, e)}
                      disabled={aEnviarImagem !== null}
                    />
                    <small className="d-block text-muted mt-1">JPG, PNG ou WebP — máximo 5 MB</small>
                    <button
                      type="submit"
                      className="btn btn-success btn-sm mt-2 w-100"
                      disabled={!ficheiros[p._id] || aEnviarImagem !== null}
                    >
                      {aEnviarImagem === p._id ? 'A enviar fotografia...' : 'Guardar fotografia'}
                    </button>
                  </form>
                </div>
              </article>
            </div>
          ))}
        </div>
      </section>
      <section className="mt-5">
        <h2 className="h4 mb-3">Encomendas recebidas</h2>
        {aCarregarEncomendas && <p>A carregar encomendas...</p>}
        {!aCarregarEncomendas && encomendas.length === 0 && (
          <p>Ainda não recebeste encomendas.</p>
        )}
        <div className="row g-3">
          {encomendas.map((o) => (
            <div className="col-md-6" key={o._id}>
              <article className="card h-100">
                <div className="card-body">
                  <h3 className="h5">Encomenda #{o._id.slice(-6).toUpperCase()}</h3>
                  <p>Comprador: {o.comprador?.nome || 'Comprador'}</p>
                  <p>Estado: <strong>{o.estado}</strong></p>
                  {o.linhas.map((linha, i) => (
                    <p key={i} className="mb-1">
                      {linha.quantidade} × {linha.nome}
                    </p>
                  ))}
                  <p className="mt-3">
                    {o.entrega?.tipo === 'entrega'
                      ? `Entrega: ${o.entrega.morada}`
                      : 'Levantamento no produtor'}
                  </p>
                  {proximosEstados[o.estado] && (
                    <button type="button" className="btn btn-success mt-2"
                      disabled={aAtualizarEncomenda !== null}
                      onClick={() => atualizarEstado(o)}>
                      {aAtualizarEncomenda === o._id
                        ? 'A atualizar...'
                        : `Marcar como ${proximosEstados[o.estado]}`}
                    </button>
                  )}
                </div>
              </article>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
