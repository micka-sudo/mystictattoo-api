import { promises as fs } from 'fs';
import path from 'path';

/**
 * Service de gestion de fichiers JSON
 * Utilise fs.promises pour des opérations non-bloquantes
 */

/**
 * Lit un fichier JSON de manière asynchrone
 */
export const readJsonFile = async <T = unknown>(filePath: string, defaultValue: T): Promise<T> => {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return data ? JSON.parse(data) as T : defaultValue;
    } catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'ENOENT') {
            return defaultValue;
        }
        console.error(`Erreur lecture ${path.basename(filePath)}:`, error.message);
        throw err;
    }
};

/**
 * Écrit dans un fichier JSON de manière asynchrone
 */
export const writeJsonFile = async <T = unknown>(filePath: string, data: T): Promise<boolean> => {
    try {
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (err) {
        const error = err as Error;
        console.error(`Erreur écriture ${path.basename(filePath)}:`, error.message);
        throw err;
    }
};

/**
 * Vérifie si un fichier existe
 */
export const fileExists = async (filePath: string): Promise<boolean> => {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
};

/**
 * Supprime un fichier de manière asynchrone
 */
export const deleteFile = async (filePath: string): Promise<boolean> => {
    try {
        await fs.unlink(filePath);
        return true;
    } catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'ENOENT') {
            return false;
        }
        console.error(`Erreur suppression ${path.basename(filePath)}:`, error.message);
        throw err;
    }
};

/**
 * Déplace un fichier de manière asynchrone
 */
export const moveFile = async (oldPath: string, newPath: string): Promise<boolean> => {
    try {
        const dir = path.dirname(newPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.rename(oldPath, newPath);
        return true;
    } catch (err) {
        const error = err as Error;
        console.error(`Erreur déplacement fichier:`, error.message);
        throw err;
    }
};

/**
 * Crée un dossier de manière asynchrone
 */
export const ensureDir = async (dirPath: string): Promise<boolean> => {
    try {
        await fs.mkdir(dirPath, { recursive: true });
        return true;
    } catch (err) {
        const error = err as Error;
        console.error(`Erreur création dossier:`, error.message);
        throw err;
    }
};

/**
 * Initialise un fichier JSON s'il n'existe pas
 */
export const initJsonFile = async <T = unknown>(filePath: string, defaultValue: T): Promise<void> => {
    const exists = await fileExists(filePath);
    if (!exists) {
        await writeJsonFile(filePath, defaultValue);
    }
};

export default {
    readJsonFile,
    writeJsonFile,
    fileExists,
    deleteFile,
    moveFile,
    ensureDir,
    initJsonFile,
};
