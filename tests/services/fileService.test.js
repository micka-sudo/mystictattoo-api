/**
 * Tests pour services/fileService.js
 */

const path = require('path');
const fs = require('fs').promises;
const {
    readJsonFile,
    writeJsonFile,
    fileExists,
    deleteFile,
    ensureDir,
    initJsonFile
} = require('../../services/fileService');

// Dossier temporaire pour les tests
const TEST_DIR = path.join(__dirname, '../temp');
const TEST_FILE = path.join(TEST_DIR, 'test.json');

describe('fileService', () => {
    // Setup: creer le dossier temp avant les tests
    beforeAll(async () => {
        await fs.mkdir(TEST_DIR, { recursive: true });
    });

    // Cleanup: supprimer les fichiers de test apres chaque test
    afterEach(async () => {
        try {
            const files = await fs.readdir(TEST_DIR);
            for (const file of files) {
                await fs.unlink(path.join(TEST_DIR, file));
            }
        } catch (err) {
            // Ignorer si le dossier est vide
        }
    });

    // Cleanup final: supprimer le dossier temp
    afterAll(async () => {
        try {
            await fs.rmdir(TEST_DIR, { recursive: true });
        } catch (err) {
            // Ignorer
        }
    });

    describe('readJsonFile', () => {
        it('devrait lire un fichier JSON valide', async () => {
            const testData = { name: 'test', value: 123 };
            await fs.writeFile(TEST_FILE, JSON.stringify(testData));

            const result = await readJsonFile(TEST_FILE);
            expect(result).toEqual(testData);
        });

        it('devrait retourner un tableau vide par defaut si le fichier n\'existe pas', async () => {
            const result = await readJsonFile(path.join(TEST_DIR, 'nonexistent.json'));
            expect(result).toEqual([]);
        });

        it('devrait retourner la valeur par defaut personnalisee si le fichier n\'existe pas', async () => {
            const defaultValue = { default: true };
            const result = await readJsonFile(path.join(TEST_DIR, 'nonexistent.json'), defaultValue);
            expect(result).toEqual(defaultValue);
        });

        it('devrait lire un tableau JSON', async () => {
            const testData = [{ id: 1 }, { id: 2 }, { id: 3 }];
            await fs.writeFile(TEST_FILE, JSON.stringify(testData));

            const result = await readJsonFile(TEST_FILE);
            expect(result).toEqual(testData);
            expect(result).toHaveLength(3);
        });
    });

    describe('writeJsonFile', () => {
        it('devrait ecrire un objet JSON', async () => {
            const testData = { name: 'test', value: 456 };
            await writeJsonFile(TEST_FILE, testData);

            const content = await fs.readFile(TEST_FILE, 'utf-8');
            expect(JSON.parse(content)).toEqual(testData);
        });

        it('devrait ecrire un tableau JSON', async () => {
            const testData = [1, 2, 3, 4, 5];
            await writeJsonFile(TEST_FILE, testData);

            const content = await fs.readFile(TEST_FILE, 'utf-8');
            expect(JSON.parse(content)).toEqual(testData);
        });

        it('devrait creer le dossier parent s\'il n\'existe pas', async () => {
            const nestedPath = path.join(TEST_DIR, 'nested', 'deep', 'test.json');
            await writeJsonFile(nestedPath, { nested: true });

            const content = await fs.readFile(nestedPath, 'utf-8');
            expect(JSON.parse(content)).toEqual({ nested: true });

            // Cleanup
            await fs.unlink(nestedPath);
            await fs.rmdir(path.join(TEST_DIR, 'nested', 'deep'));
            await fs.rmdir(path.join(TEST_DIR, 'nested'));
        });

        it('devrait retourner true en cas de succes', async () => {
            const result = await writeJsonFile(TEST_FILE, { success: true });
            expect(result).toBe(true);
        });
    });

    describe('fileExists', () => {
        it('devrait retourner true si le fichier existe', async () => {
            await fs.writeFile(TEST_FILE, 'test');
            const result = await fileExists(TEST_FILE);
            expect(result).toBe(true);
        });

        it('devrait retourner false si le fichier n\'existe pas', async () => {
            const result = await fileExists(path.join(TEST_DIR, 'nonexistent.txt'));
            expect(result).toBe(false);
        });
    });

    describe('deleteFile', () => {
        it('devrait supprimer un fichier existant', async () => {
            await fs.writeFile(TEST_FILE, 'to delete');
            const result = await deleteFile(TEST_FILE);

            expect(result).toBe(true);
            await expect(fs.access(TEST_FILE)).rejects.toThrow();
        });

        it('devrait retourner false si le fichier n\'existe pas', async () => {
            const result = await deleteFile(path.join(TEST_DIR, 'nonexistent.txt'));
            expect(result).toBe(false);
        });
    });

    describe('ensureDir', () => {
        it('devrait creer un dossier', async () => {
            const newDir = path.join(TEST_DIR, 'newdir');
            const result = await ensureDir(newDir);

            expect(result).toBe(true);
            const stat = await fs.stat(newDir);
            expect(stat.isDirectory()).toBe(true);

            // Cleanup
            await fs.rmdir(newDir);
        });

        it('devrait creer des dossiers imbriques', async () => {
            const nestedDir = path.join(TEST_DIR, 'a', 'b', 'c');
            await ensureDir(nestedDir);

            const stat = await fs.stat(nestedDir);
            expect(stat.isDirectory()).toBe(true);

            // Cleanup
            await fs.rmdir(nestedDir);
            await fs.rmdir(path.join(TEST_DIR, 'a', 'b'));
            await fs.rmdir(path.join(TEST_DIR, 'a'));
        });
    });

    describe('initJsonFile', () => {
        it('devrait creer un fichier avec la valeur par defaut s\'il n\'existe pas', async () => {
            const initFile = path.join(TEST_DIR, 'init.json');
            await initJsonFile(initFile, []);

            const content = await fs.readFile(initFile, 'utf-8');
            expect(JSON.parse(content)).toEqual([]);
        });

        it('ne devrait pas ecraser un fichier existant', async () => {
            const existingData = { existing: true };
            await fs.writeFile(TEST_FILE, JSON.stringify(existingData));

            await initJsonFile(TEST_FILE, []);

            const content = await fs.readFile(TEST_FILE, 'utf-8');
            expect(JSON.parse(content)).toEqual(existingData);
        });
    });
});
