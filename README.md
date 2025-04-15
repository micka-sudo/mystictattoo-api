# 🐉 MysticTattoo API

Backend Express pour le site de réservation et gestion d’un salon de tatouage situé à Nancy (54000).

> ⚙️ Projet développé en Node.js + Express avec gestion des images, authentification admin, et API REST sécurisée.

---

## 🚀 Fonctionnalités

- Authentification **admin** (avec JWT)
- Upload d'images (avec conversion `.heic` → `.webp`)
- Optimisation d'images avec `sharp`
- Listing et suppression des médias
- Connexion frontend ↔ backend via API REST
- Système de réservation (à venir)
- Déploiement continu via **Render** ou **NAS Synology**

---

## 📁 Structure du projet

```bash
mystictattoo-api/
├── index.js               # Point d'entrée principal
├── routes/
│   ├── auth.js            # Login admin via mot de passe
│   ├── upload.js          # Upload + conversion images
│   └── media.js           # Accès/gestion des fichiers uploadés
├── uploads/               # Dossier public des images
├── .env                   # Clés secrètes et config
├── render.yaml            # Déploiement auto Render
├── package.json           # Dépendances
└── README.md              # Documentation (ce fichier)
