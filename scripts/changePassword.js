const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const configPath = path.join(__dirname, '..', 'config', 'admin.json');
const newPassword = process.argv[2];

if (!newPassword) {
    console.error('❌ Veuillez fournir un mot de passe');
    process.exit(1);
}

(async () => {
    try {
        const hash = await bcrypt.hash(newPassword, 10);
        fs.writeFileSync(configPath, JSON.stringify({ passwordHash: hash }, null, 2));
        console.log('✅ Mot de passe admin mis à jour');
    } catch (err) {
        console.error('❌ Erreur :', err);
    }
})();
