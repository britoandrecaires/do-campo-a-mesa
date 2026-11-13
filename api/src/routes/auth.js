
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const porFazer = require('./_naoImplementado');

// Dados públicos, sem a password
function utilizadorPublico(u) {
    return {
        id: u._id.toString(),
        nome: u.nome,
        email: u.email,
        papel: u.papel,
        ...(u.papel === 'produtor' ? { produtor: u.produtor } : {})
    };
}

// Registo: implementar depois

router.post('/registo', async (req, res, next) => {
    try {
        const {
            nome,
            email,
            password,
            papel = 'comprador',
            nomeExploracao,
            localidade
        } = req.body || {};

        const nomeLimpo = typeof nome === 'string'
            ? nome.trim() : '';

        const emailLimpo = typeof email === 'string'
            ? email.trim().toLowerCase() : '';

        // Validar os campos obrigatórios
        if (!nomeLimpo || !/^\S+@\S+\.\S+$/.test(emailLimpo)) {
            return res.status(400).json({
                erro: 'Nome e email válido são obrigatórios'
            });
        }

        if (typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({
                erro: 'A password deve ter pelo menos 8 caracteres'
            });
        }

        // Impedir o registo público como administrador
        if (!['comprador', 'produtor'].includes(papel)) {
            return res.status(400).json({
                erro: 'Tipo de conta inválido'
            });
        }

        if (papel === 'produtor' &&
            (!nomeExploracao?.trim() || !localidade?.trim())) {
            return res.status(400).json({
                erro: 'Nome da exploração e localidade são obrigatórios'
            });
        }

        const existe = await User.exists({ email: emailLimpo });

        if (existe) {
            return res.status(409).json({
                erro: 'Este email já está registado'
            });
        }

        // Guardar hash, nunca a password original
        const passwordHash = await bcrypt.hash(password, 12);

        const novo = await User.create({
            nome: nomeLimpo,
            email: emailLimpo,
            passwordHash,
            papel,
            ...(papel === 'produtor' ? {
                produtor: {
                    nomeExploracao: nomeExploracao.trim(),
                    localidade: localidade.trim(),
                    validado: false,
                    estadoValidacao: 'pendente'
                }
            } : {})
        });

        return res.status(201).json({
            id: novo._id.toString(),
            mensagem: 'Registo efetuado com sucesso'
        });

    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({
                erro: 'Este email já está registado'
            });
        }
        next(err);
    }
});


// LOGIN
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body || {};

        if (typeof email !== 'string' ||
            typeof password !== 'string' ||
            !email.trim() || !password) {
            return res.status(400).json({
                erro: 'Email e password são obrigatórios'
            });
        }

        const u = await User.findOne({
            email: email.trim().toLowerCase()
        }).select('+passwordHash');

        if (!u || !(await bcrypt.compare(password, u.passwordHash))) {
            return res.status(401).json({
                erro: 'Credenciais inválidas'
            });
        }

        const token = jwt.sign(
            { id: u._id.toString(), papel: u.papel, nome: u.nome },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '2h' }
        );

        return res.json({
            token,
            utilizador: utilizadorPublico(u)
        });
    } catch (err) {
        next(err);
    }
});

// Consultar o utilizador autenticado
router.get('/eu', auth(), async (req, res, next) => {
    try {
        const u = await User.findById(req.user.id);

        if (!u) {
            return res.status(401).json({
                erro: 'Sessão inválida'
            });
        }

        return res.json(utilizadorPublico(u));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
