
const { Schema, model, Types } = require('mongoose');

const ESTADOS = [
  'pendente',
  'confirmada',
  'pronta',
  'entregue'
];

const orderSchema = new Schema({

  // Comprador da encomenda
  comprador: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Produtor responsável
  produtor: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Produtos ou lotes comprados
  linhas: [{
    produto: {
      type: Types.ObjectId,
      ref: 'Product'
    },

    nome: String,

    precoUnit: {
      type: Number,
      required: true,
      min: 0
    },

    unidade: {
      type: String,
      default: 'unidade'
    },

    quantidade: {
      type: Number,
      required: true,
      min: 1
    }
  }],

  // Estado da encomenda
  estado: {
    type: String,
    enum: ESTADOS,
    default: 'pendente'
  },

  // Levantamento ou entrega
  entrega: {
    tipo: {
      type: String,
      enum: ['levantamento', 'entrega'],
      default: 'levantamento'
    },

    morada: String
  },

  // Origem da encomenda
  origem: {
    type: String,
    enum: ['catalogo', 'leilao'],
    default: 'catalogo'
  },

  // Leilão associado, se existir
  leilao: {
    type: Types.ObjectId,
    ref: 'Auction',
    default: null
  }

}, {
  timestamps: true
});

// Impedir duas encomendas para o mesmo leilão.
// Não afeta as encomendas normais do catálogo.
orderSchema.index(
  { leilao: 1 },
  {
    unique: true,
    partialFilterExpression: {
      leilao: { $type: 'objectId' }
    }
  }
);

orderSchema.statics.ESTADOS = ESTADOS;

module.exports = model('Order', orderSchema);
