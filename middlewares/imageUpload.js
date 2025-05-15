const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const heicConvert = require('heic-convert');

const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `${timestamp}-${file.originalname}`);
    }
});

const upload = multer({ storage });

const imageUpload = upload.single('image');

const convertHeicToJpeg = async (req, res, next) => {
    const file = req.file;

    if (!file) return next();

    const mimeType = file.mimetype;

    if (mimeType !== 'image/heic') {
        return next();
    }

    try {
        const inputBuffer = await fs.readFile(file.path);
        const outputBuffer = await heicConvert({
            buffer: inputBuffer,
            format: 'JPEG',
            quality: 1
        });

        const jpegFilename = file.filename.replace(path.extname(file.filename), '.jpg');
        const jpegPath = path.join('uploads', jpegFilename);

        await fs.writeFile(jpegPath, outputBuffer);
        await fs.unlink(file.path);

        req.file.filename = jpegFilename;
        req.file.path = jpegPath;
        req.file.mimetype = 'image/jpeg';

        next();
    } catch (error) {
        console.error('Erreur de conversion HEIC :', error);
        return res.status(500).json({ error: 'Erreur lors de la conversion HEIC.' });
    }
};

module.exports = {
    imageUpload,
    convertHeicToJpeg
};
