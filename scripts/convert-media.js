const path = require('path');
const fs = require('fs/promises');
const heicConvert = require('heic-convert');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const mime = require('mime-types');

ffmpeg.setFfmpegPath(ffmpegPath);

// Chemin de base
const uploadsDir = path.join(__dirname, '..', 'uploads');

async function convertHeicToJpeg(filePath) {
    const inputBuffer = await fs.readFile(filePath);
    const outputBuffer = await heicConvert({
        buffer: inputBuffer,
        format: 'JPEG',
        quality: 1
    });

    const outputPath = filePath.replace(/\.[Hh][Ee][Ii][Cc]$/, '.jpg');
    await fs.writeFile(outputPath, outputBuffer);
    await fs.unlink(filePath);
    console.log(`✅ Converti image : ${filePath} → ${outputPath}`);
}

async function convertMovToMp4(filePath) {
    const outputPath = filePath.replace(/\.[Mm][Oo][Vv]$/, '.mp4');

    return new Promise((resolve, reject) => {
        ffmpeg(filePath)
            .output(outputPath)
            .videoCodec('libx264')
            .audioCodec('aac')
            .on('end', async () => {
                await fs.unlink(filePath);
                console.log(`🎞️ Converti vidéo : ${filePath} → ${outputPath}`);
                resolve();
            })
            .on('error', (err) => {
                console.error(`❌ Erreur conversion vidéo : ${filePath}`, err);
                reject(err);
            })
            .run();
    });
}

async function processDirectory(directoryPath) {
    const items = await fs.readdir(directoryPath, { withFileTypes: true });

    for (const item of items) {
        const itemPath = path.join(directoryPath, item.name);

        if (item.isDirectory()) {
            await processDirectory(itemPath); // récursivité
        } else {
            const mimeType = mime.lookup(itemPath);
            const ext = path.extname(item.name).toLowerCase();

            if (mimeType === 'image/heic' || ext === '.heic') {
                await convertHeicToJpeg(itemPath);
            }

            if (ext === '.mov') {
                await convertMovToMp4(itemPath);
            }
        }
    }
}

// Lancer le script
(async () => {
    try {
        console.log('🔍 Scan du dossier uploads...');
        await processDirectory(uploadsDir);
        console.log('✅ Conversion terminée !');
    } catch (err) {
        console.error('❌ Erreur lors de la conversion :', err);
    }
})();
