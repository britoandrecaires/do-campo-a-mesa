
const { Schema, model, Types } = require('mongoose');

// Avaliações numa coleção própria.
// Permite consultar, moderar e paginar avaliações.

const reviewSchema = new Schema({

  // Comprador responsável pela avaliação
  autor: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Produtor avaliado
  produtor: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Produto avaliado (opcional)
  produto: {
    type: Types.ObjectId,
    ref: 'Product',
    default: null
  },

  // Encomenda associada à avaliação
  encomenda: {
    type: Types.ObjectId,
    ref: 'Order',
    required: true
  },

  // Tipo de avaliação
  tipo: {
    type: String,
    enum: ['produto', 'produtor'],
    required: true
  },

  // Classificação de 1 a 5 estrelas
  classificacao: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    validate: {
      validator: Number.isInteger,
      message: 'A classificação deve ser um inteiro'
    }
  },

  // Comentário do comprador
  comentario: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: ''
  },

  // Número de denúncias por analisar
  denuncias: {
    type: Number,
    default: 0,
    min: 0
  },

  // NOVO: utilizadores que denunciaram
  // Não expor estes dados nas consultas públicas
  denunciantes: {
    type: [{
      type: Types.ObjectId,
      ref: 'User'
    }],
    default: [],
    select: false
  },

  // Visibilidade controlada pelo administrador
  visivel: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true
});

// Validar a associação entre tipo e produto
reviewSchema.pre('validate', function () {
  if (this.tipo === 'produto' && !this.produto) {
    this.invalidate(
      'produto',
      'Seleciona o produto a avaliar'
    );
  }

  if (this.tipo === 'produtor' && this.produto) {
    this.invalidate(
      'produto',
      'Uma avaliação de produtor não deve indicar produto'
    );
  }
});

// Impedir avaliações duplicadas
// do mesmo item na mesma encomenda
reviewSchema.index(
  {
    autor: 1,
    encomenda: 1,
    tipo: 1,
    produto: 1
  },
  {
    unique: true
  }
);

// Facilitar consultas públicas
reviewSchema.index({
  produtor: 1,
  visivel: 1,
  createdAt: -1
});

module.exports = model('Review', reviewSchema);
