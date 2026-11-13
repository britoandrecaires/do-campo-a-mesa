
/*
 * Configuração da aplicação Express
 * API REST + ficheiros estáticos + Swagger
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const errorHandler = require('./middleware/errorHandler');

// Serviço responsável pelas imagens dos produtos
const { PASTA_IMAGENS } = require('./services/imagens');

const app = express();

// ========================================
// 1. CONFIGURAÇÕES GERAIS
// ========================================

app.use(cors({
    origin: process.env.CLIENT_URL || '*'
}));

app.use(express.json());

// ========================================
// 2. DISPONIBILIZAR IMAGENS
// ========================================

// Permite abrir as fotografias guardadas localmente
// através de /uploads/produtos/nome-da-imagem.jpg

app.use(
    '/uploads/produtos',
    express.static(PASTA_IMAGENS, {
        index: false,
        dotfiles: 'deny',
        setHeaders: (res) => {
            res.setHeader(
                'X-Content-Type-Options',
                'nosniff'
            );
        }
    })
);

// ========================================
// 3. DOCUMENTAÇÃO OPENAPI / SWAGGER
// ========================================

const openapi = YAML.load(
    path.join(__dirname, '..', 'openapi.yaml')
);

app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openapi)
);

// ========================================
// 4. HEALTH CHECK
// ========================================

app.get('/api/health', (req, res) => {
    res.json({
        estado: 'ok'
    });
});

// ========================================
// 5. ROTAS DA API
// ========================================

app.use('/api/auth', require('./routes/auth'));

app.use('/api/products', require('./routes/products'));

app.use('/api/producers', require('./routes/producers'));

app.use('/api/orders', require('./routes/orders'));

app.use('/api/auctions', require('./routes/auctions'));

app.use('/api/reviews', require('./routes/reviews'));

app.use('/api/admin', require('./routes/admin'));

// ========================================
// 6. RECURSOS NÃO ENCONTRADOS
// ========================================

app.use((req, res) => {
    return res.status(404).json({
        erro: 'Recurso não encontrado'
    });
});

// ========================================
// 7. TRATAMENTO GLOBAL DE ERROS
// ========================================

app.use(errorHandler);

module.exports = app;
