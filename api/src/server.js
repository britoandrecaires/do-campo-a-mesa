
// Ponto de entrada: API REST + Socket.io
require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');

const app = require('./app');
const { ligarBD } = require('./config/db');
const registarSockets = require('./sockets');

// Serviço de abertura e encerramento automático
const {
  iniciarCicloLeiloes
} = require('./services/cicloLeiloes');

const PORT = process.env.PORT || 3000;

async function iniciar() {
  // 1. Ligar ao MongoDB Atlas
  await ligarBD();

  // 2. Criar servidor HTTP
  const server = http.createServer(app);

  // 3. Configurar Socket.io
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || '*'
    }
  });

  // 4. Disponibilizar Socket.io às rotas REST
  app.set('io', io);

  // 5. Registar os eventos Socket.io
  registarSockets(io);

  // 6. Iniciar servidor e ciclo automático
  server.listen(PORT, () => {
    console.log(`API em http://localhost:${PORT}`);
    console.log(
      `Documentação em http://localhost:${PORT}/api-docs`
    );

    // Verificar os leilões a cada 2 segundos
    iniciarCicloLeiloes(io);

    console.log(
      'Ciclo automático de leilões iniciado!'
    );
  });
}

// Tratar erros ao iniciar a aplicação
iniciar().catch((err) => {
  console.error('Erro ao iniciar o servidor:', err);
  process.exit(1);
});
