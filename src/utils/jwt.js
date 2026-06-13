const jwt = require('jsonwebtoken');

const generateToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET || 'MrCat23', {
        expiresIn: '24h',
    });
};

const verifyToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET || 'MrCat23');
};

module.exports = {
    generateToken,
    verifyToken,
};