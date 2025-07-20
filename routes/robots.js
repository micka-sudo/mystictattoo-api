// routes/robots.js
const express = require('express');
const router = express.Router();

router.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send(`User-agent: *
Disallow:

Sitemap: https://www.mystic-tattoo.fr/sitemap.xml
Host: https://www.mystic-tattoo.fr`);
});

module.exports = router;
