const express = require('express');
const router = express.Router();
require('dotenv').config();


router.use('/upload', require('./upload'));
router.use('/login', require('./auth'));
router.use('/media', require('./media'));
router.use('/news', require('./news'));
router.use('/reservations', require('./reservation')); // futur module

module.exports = router;
