/**
 * Jest Setup File
 * Configuration globale pour les tests
 */

// Variables d'environnement pour les tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.JWT_EXPIRY = '1h';
process.env.PORT = '4001';

// Timeout global
jest.setTimeout(10000);

// Supprime les console.log pendant les tests (optionnel)
if (process.env.SILENT_TESTS === 'true') {
    global.console = {
        ...console,
        log: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
    };
}

// Nettoyage apres chaque test
afterEach(() => {
    jest.clearAllMocks();
});
