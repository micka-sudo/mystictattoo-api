import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import heicConvert from 'heic-convert';
import { Request, Response, NextFunction } from 'express';
import { FileRequest } from '../types';

const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (_req, file, cb) => {
        const timestamp = Date.now();
        cb(null, `${timestamp}-${file.originalname}`);
    },
});

const upload = multer({ storage });

export const imageUpload = upload.single('image');

export const convertHeicToJpeg = async (
    req: FileRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const file = req.file;

    if (!file) {
        next();
        return;
    }

    const mimeType = file.mimetype;

    if (mimeType !== 'image/heic') {
        next();
        return;
    }

    try {
        const inputBuffer = await fs.readFile(file.path);
        const outputBuffer = await heicConvert({
            buffer: inputBuffer,
            format: 'JPEG',
            quality: 1,
        });

        const jpegFilename = file.filename.replace(path.extname(file.filename), '.jpg');
        const jpegPath = path.join('uploads', jpegFilename);

        await fs.writeFile(jpegPath, Buffer.from(outputBuffer));
        await fs.unlink(file.path);

        req.file!.filename = jpegFilename;
        req.file!.path = jpegPath;
        req.file!.mimetype = 'image/jpeg';

        next();
    } catch (error) {
        console.error('Erreur de conversion HEIC :', error);
        res.status(500).json({ error: 'Erreur lors de la conversion HEIC.' });
    }
};
