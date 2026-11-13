
const { Schema, model, Types } = require('mongoose');

// Modelo de leilões em direto
const auctionSchema = new Schema({

  // Produtor responsável pelo leilão
  produtor: {
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Produto associado (opcional)
  produto: {
    type: Types.ObjectId,
    ref: 'Product'
  },

  // Informações do lote
  lote: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },

  descricao: {
    type: String,
    maxlength: 1000,
    default: ''
  },

  quantidade: {
    type: String
  },

  // Valores do leilão
  precoBase: {
    type: Number,
    required: true,
    min: 0.01
  },

  incremento: {
    type: Number,
    required: true,
    min: 0.01
  },

  // Última licitação aceite
  licitacaoAtual: {
    valor: {
      type: Number,
      required: true,
      min: 0
    },

    comprador: {
      type: Types.ObjectId,
      ref: 'User'
    },

    nome: String,
    em: Date
  },

  // Número total de licitações
  numLicitacoes: {
    type: Number,
    default: 0,
    min: 0
  },

  // Datas do leilão
  iniciaEm: {
    type: Date,
    required: true
  },

  terminaEm: {
    type: Date,
    required: true,
    index: true
  },

  // Estado do leilão
  estado: {
    type: String,
    enum: [
      'agendado',
      'ativo',
      'terminado'
    ],
    default: 'agendado',
    index: true
  },

  // Encomenda criada para o vencedor
  encomenda: {
    type: Types.ObjectId,
    ref: 'Order'
  }

}, {
  timestamps: true
});

// Pesquisa eficiente dos leilões por encerrar
auctionSchema.index({
  estado: 1,
  terminaEm: 1
});

module.exports = model('Auction', auctionSchema);
