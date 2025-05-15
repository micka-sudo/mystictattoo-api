const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `${timestamp}-${file.originalname}`);
    }
});

const upload = multer({ storage });

const videoUpload = upload.single('video');

const convertMovToMp4 = async (req, res, next) => {
    const file = req.file;

    if (!file) return next();

    const ext = path.extname(file.originalname).toLowerCase();

    if (ext !== '.mov') {
        return next();
    }

    const mp4Filename = file.filename.replace('.mov', '.mp4');
    const mp4Path = path.join('uploads', mp4Filename);

    ffmpeg(file.path)
        .output(mp4Path)
        .videoCodec('libx264')
        .audioCodec('aac')
        .on('end', async () => {
            await fs.unlink(file.path);
            req.file.filename = mp4Filename;
            req.file.path = mp4Path;
            req.file.mimetype = 'video/mp4';
            next();
        })
        .on('error', (err) => {
            console.error('Erreur de conversion vidéo :', err);
            return res.status(500).json({ error: 'Erreur lors de la conversion vidéo.' });
        })
        .run();
};

module.exports = {
    videoUpload,
    convertMovToMp4
};
