import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Mystic Tattoo API',
            version: '1.2.1',
            description: 'API pour le site Mystic Tattoo - Gestion des médias, actualités et réservations',
            contact: {
                name: 'Mystic Tattoo',
                url: 'https://www.mystic-tattoo.fr'
            }
        },
        servers: [
            {
                url: 'http://localhost:4000',
                description: 'Serveur de développement'
            },
            {
                url: 'https://api.mystic-tattoo.fr',
                description: 'Serveur de production'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Token JWT obtenu via /api/login'
                }
            },
            schemas: {
                Media: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                        filename: { type: 'string', example: 'tattoo-123456789.opt.webp' },
                        path: { type: 'string', example: '/uploads/Tattoo noir et blanc/tattoo.opt.webp' },
                        category: { type: 'string', example: 'Tattoo noir et blanc' },
                        type: { type: 'string', enum: ['image', 'video'] },
                        cloudUrl: { type: 'string', example: 'https://res.cloudinary.com/...' },
                        tags: { type: 'array', items: { type: 'string' } },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },
                News: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        title: { type: 'string', maxLength: 200 },
                        content: { type: 'string' },
                        image: { type: 'string' },
                        isVisible: { type: 'boolean' },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },
                Reservation: {
                    type: 'object',
                    properties: {
                        id: { type: 'number' },
                        name: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                        message: { type: 'string' },
                        date: { type: 'string' },
                        status: { type: 'string', enum: ['en attente', 'acceptée', 'refusée', 'terminée'] },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' }
                    }
                }
            }
        },
        tags: [
            { name: 'Auth', description: 'Authentification admin' },
            { name: 'Media', description: 'Gestion des médias (images/vidéos)' },
            { name: 'News', description: 'Gestion des actualités' },
            { name: 'Reservation', description: 'Gestion des réservations' },
            { name: 'Config', description: 'Configuration du site' }
        ]
    },
    apis: ['./src/routes/*.ts']
};

export default swaggerJsdoc(options);
