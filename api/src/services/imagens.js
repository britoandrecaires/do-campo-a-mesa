
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

// Pasta utilizada durante o desenvolvimento local
const PASTA_IMAGENS = path.resolve(
  __dirname,
  '../../uploads/produtos'
);

const TAMANHO_MAXIMO = 5 * 1024 * 1024;

// Identificar o formato pelo conteúdo do ficheiro
function identificarImagem(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    return null;
  }

  // JPEG
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return {
      extensao: '.jpg',
      mimetype: 'image/jpeg'
    };
  }

  // PNG
  const assinaturaPNG = Buffer.from([
    137, 80, 78, 71, 13, 10, 26, 10
  ]);

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(assinaturaPNG)
  ) {
    return {
      extensao: '.png',
      mimetype: 'image/png'
    };
  }

  // WebP
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return {
      extensao: '.webp',
      mimetype: 'image/webp'
    };
  }

  return null;
}

// Validar imagem recebida pelo Multer
function validarImagem(ficheiro) {
  if (!ficheiro || !Buffer.isBuffer(ficheiro.buffer)) {
    throw new Error('Nenhuma imagem foi enviada');
  }

  if (
    ficheiro.buffer.length === 0 ||
    ficheiro.buffer.length > TAMANHO_MAXIMO
  ) {
    throw new Error(
      'A imagem deve ter no máximo 5 MB'
    );
  }

  const formato = identificarImagem(ficheiro.buffer);

  if (!formato || ficheiro.mimetype !== formato.mimetype) {
    throw new Error(
      'Formato inválido. Utiliza JPG, PNG ou WebP'
    );
  }

  return formato;
}

// Guardar imagem no computador durante o desenvolvimento
async function guardarLocalmente(ficheiro, nome) {
  await fs.mkdir(PASTA_IMAGENS, {
    recursive: true
  });

  const destino = path.join(PASTA_IMAGENS, nome);

  await fs.writeFile(destino, ficheiro.buffer, {
    flag: 'wx'
  });

  // Endereço público da nossa API local
  const apiPublica = (
    process.env.API_PUBLIC_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');

  return `${apiPublica}/uploads/produtos/${nome}`;
}

// Guardar imagem na Azure Blob Storage
async function guardarNaAzure(ficheiro, nome, mimetype) {
  // Importar SDK apenas quando utilizamos Azure
  const {
    BlobServiceClient
  } = require('@azure/storage-blob');

  const cliente = BlobServiceClient.fromConnectionString(
    process.env.STORAGE_CONN
  );

  const container = cliente.getContainerClient(
    process.env.STORAGE_CONTAINER || 'produtos'
  );

  // Criar o container caso ainda não exista
  await container.createIfNotExists();

  const blob = container.getBlockBlobClient(nome);

  await blob.uploadData(ficheiro.buffer, {
    blobHTTPHeaders: {
      blobContentType: mimetype
    }
  });

  return blob.url;
}

// Função utilizada pelas rotas de produtos
async function guardarImagem(ficheiro) {
  const formato = validarImagem(ficheiro);

  // Nome aleatório: evita colisões e nomes perigosos
  const nome = `${randomUUID()}${formato.extensao}`;

  // Produção: exigir Azure configurada
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.STORAGE_CONN) {
      throw new Error(
        'Configura STORAGE_CONN antes de publicar a aplicação'
      );
    }
  }

  // Se o Azure estiver configurado, utilizá-lo
  if (process.env.STORAGE_CONN) {
    return guardarNaAzure(
      ficheiro,
      nome,
      formato.mimetype
    );
  }

  // Caso contrário, guardar localmente
  return guardarLocalmente(ficheiro, nome);
}

module.exports = {
  guardarImagem,
  PASTA_IMAGENS
};
