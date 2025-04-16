# 🖤 MysticTattoo API (Backend)

Backend de gestion pour le site [Mystic Tattoo](https://magiccircus.paris sans blog/support/piercing) situé à **Nancy 54000**.

Fonctionnalités principales :
- Upload et gestion des médias par catégorie
- Gestion des actualités
- Réservations clients (validation admin)
- Connexion sécurisée pour les administrateurs
- Déploiement continu via GitHub + Render

---

## 🚀 Stack technique

- **Node.js** + **Express**
- **MongoDB** avec Mongoose
- **JWT** pour l’authentification
- **Multer** pour upload fichiers (images / vidéos)
- **Dotenv** pour la config `.env`
- **Helmet**, **CORS** pour la sécurité
- Hébergé sur **Render** (déploiement automatique via GitHub)

---

## 📦 Installation locale

```bash
git clone https://github.com/micka-sudo/mystictattoo-api.git
cd mystictattoo-api
npm install
cp .env.example .env
⚙️ Scripts utiles

Commande	Description
npm run dev	Lance le serveur en dev (via nodemon)
npm start	Lance en mode production
npm run lint	Lint le projet avec ESLint
npm run test	Lance les tests unitaires (si présents)

PORT=5000
MONGO_URI=mongodb+srv://<user>:<mdp>@cluster.mongodb.net/mystictattoo
JWT_SECRET=une_clé_ultra_secrète
UPLOAD_DIR=uploads

Méthode | Route | Description
POST | /auth/login | Connexion admin (JWT)

Méthode | Route | Description
GET | /media | Tous les médias (admin ou public)
GET | /media?style=x | Médias filtrés par catégorie (ex: graphique)
POST | /upload | Upload fichier (auth admin requis)
DELETE | /media | Supprimer un fichier (auth requis)
GET | /media/categories | Liste des catégories (hors "actus")
POST | /media/category | Ajouter une nouvelle catégorie
DELETE | /media/category | Supprimer une catégorie (si vide)

Méthode | Route | Description
GET | /news | Liste des actualités
POST | /news | Ajouter une actu (auth admin requis)


Méthode | Route | Description
POST | /reservation | Créer une demande de réservation
GET | /reservation | Liste pour l’admin
PATCH | /reservation/:id | Valider ou refuser la demande

mystictattoo-api/
├── controllers/       # Logique pour chaque route
├── routes/            # Routes Express
├── models/            # Schémas Mongoose (Media, News, Reservation, Admin)
├── middlewares/       # JWT, multer, validation etc.
├── uploads/           # Fichiers uploadés
├── utils/             # Fonctions utilitaires
├── .env               # Configuration sensible
├── server.js          # Point d'entrée de l'API
└── package.json

Authorization: Bearer <token>

🚀 Déploiement continu avec Render
Lier le repo GitHub à https://dashboard.render.com

Ajouter les variables d’environnement (PORT, MONGO_URI, etc.)

Activer le deploy on push dans Render

L’API sera disponible sur une URL du type : https://mystictattoo-api.onrender.com


✅ Checklist admin
 Ajout/suppression catégorie

 Upload image/vidéo par style

 Aperçu visuel des médias

 Filtrage dynamique galerie

 Validation des réservations

 Ajout d’actualités

✨ À faire plus tard
 Pagination sur la galerie

 Email de confirmation réservation

 Super-admin avec logs

 Statistiques dashboard

npm run test

📫 Contact
Développeur : Gruy
Ville : Xxxx
GitHub : github.com/micka-sudo
