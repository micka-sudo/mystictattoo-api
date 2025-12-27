import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { Response, NextFunction } from 'express';
import { FileRequest } from '../types';

if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}

const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (_req, file, cb) => {
        const timestamp = Date.now();
        cb(null, `${timestamp}-${file.originalname}`);
    },
});

const upload = multer({ storage });

export const videoUpload = upload.single('video');

export const convertMovToMp4 = (
    req: FileRequest,
    res: Response,
    next: NextFunction
): void => {
    const file = req.file;

    if (!file) {
        next();
        return;
    }

    const ext = path.extname(file.originalname).toLowerCase();

    if (ext !== '.mov') {
        next();
        return;
    }

    const mp4Filename = file.filename.replace('.mov', '.mp4');
    const mp4Path = path.join('uploads', mp4Filename);

    ffmpeg(file.path)
        .output(mp4Path)
        .videoCodec('libx264')
        .audioCodec('aac')
        .on('end', async () => {
            await fs.unlink(file.path);
            req.file!.filename = mp4Filename;
            req.file!.path = mp4Path;
            req.file!.mimetype = 'video/mp4';
            next();
        })
        .on('error', (err) => {
            console.error('Erreur de conversion vidéo :', err);
            res.status(500).json({ error: 'Erreur lors de la conversion vidéo.' });
        })
        .run();
};
