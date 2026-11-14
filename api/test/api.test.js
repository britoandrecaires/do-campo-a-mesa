
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

// Segredo exclusivo para testes, sem credenciais reais.
process.env.JWT_SECRET = 'segredo-local-apenas-para-testes';

const app = require('../src/app');

let servidor;
let urlBase;

before(async () => {
    servidor = app.listen(0);

    await new Promise((resolve) => {
        servidor.once('listening', resolve);
    });

    urlBase = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
    await new Promise((resolve) => servidor.close(resolve));
});

// TESTE 1 — API operacional
test('GET /api/health devolve 200', async () => {
    const resposta = await fetch(`${urlBase}/api/health`);
    const dados = await resposta.json();

    assert.equal(resposta.status, 200);
    assert.equal(dados.estado, 'ok');
});

// TESTE 2 — Rota protegida sem autenticação
test('Administrador sem token recebe 401', async () => {
    const resposta = await fetch(
        `${urlBase}/api/admin/estatisticas`
    );

    assert.equal(resposta.status, 401);
});

// TESTE 3 — Encomenda sem produtos
test('Encomenda vazia recebe 400', async () => {
    const token = jwt.sign(
        { id: '000000000000000000000001', papel: 'comprador' },
        process.env.JWT_SECRET
    );

    const resposta = await fetch(`${urlBase}/api/orders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            linhas: [],
            entrega: { tipo: 'levantamento' }
        })
    });

    assert.equal(resposta.status, 400);
});

// TESTE 4 — Impedir registo como administrador
test('Registo público como admin recebe 400', async () => {
    const resposta = await fetch(`${urlBase}/api/auth/registo`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            nome: 'Utilizador Teste',
            email: 'teste@example.com',
            password: 'password123',
            papel: 'admin'
        })
    });

    assert.equal(resposta.status, 400);
});
