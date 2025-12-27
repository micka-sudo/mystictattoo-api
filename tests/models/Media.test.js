/**
 * Tests pour models/Media.js
 */

const mongoose = require('mongoose');
const Media = require('../../models/Media');

describe('Media Model', () => {
    describe('Schema Validation', () => {
        it('devrait creer un media valide avec tous les champs requis', () => {
            const validMedia = new Media({
                filename: 'test-image.webp',
                path: '/uploads/Tattoo/test-image.webp',
                category: 'Tattoo',
                type: 'image'
            });

            const error = validMedia.validateSync();
            expect(error).toBeUndefined();
        });

        it('devrait echouer sans filename', () => {
            const media = new Media({
                path: '/uploads/Tattoo/test.webp',
                category: 'Tattoo',
                type: 'image'
            });

            const error = media.validateSync();
            expect(error).toBeDefined();
            expect(error.errors.filename).toBeDefined();
        });

        it('devrait echouer sans path', () => {
            const media = new Media({
                filename: 'test.webp',
                category: 'Tattoo',
                type: 'image'
            });

            const error = media.validateSync();
            expect(error).toBeDefined();
            expect(error.errors.path).toBeDefined();
        });

        it('devrait echouer sans category', () => {
            const media = new Media({
                filename: 'test.webp',
                path: '/uploads/Tattoo/test.webp',
                type: 'image'
            });

            const error = media.validateSync();
            expect(error).toBeDefined();
            expect(error.errors.category).toBeDefined();
        });

        it('devrait echouer sans type', () => {
            const media = new Media({
                filename: 'test.webp',
                path: '/uploads/Tattoo/test.webp',
                category: 'Tattoo'
            });

            const error = media.validateSync();
            expect(error).toBeDefined();
            expect(error.errors.type).toBeDefined();
        });

        it('devrait echouer avec un type invalide', () => {
            const media = new Media({
                filename: 'test.webp',
                path: '/uploads/Tattoo/test.webp',
                category: 'Tattoo',
                type: 'audio' // Invalid type
            });

            const error = media.validateSync();
            expect(error).toBeDefined();
            expect(error.errors.type).toBeDefined();
        });

        it('devrait accepter type "image"', () => {
            const media = new Media({
                filename: 'test.webp',
                path: '/uploads/Tattoo/test.webp',
                category: 'Tattoo',
                type: 'image'
            });

            const error = media.validateSync();
            expect(error).toBeUndefined();
        });

        it('devrait accepter type "video"', () => {
            const media = new Media({
                filename: 'test.mp4',
                path: '/uploads/Tattoo/test.mp4',
                category: 'Tattoo',
                type: 'video'
            });

            const error = media.validateSync();
            expect(error).toBeUndefined();
        });

        it('devrait avoir tags comme tableau vide par defaut', () => {
            const media = new Media({
                filename: 'test.webp',
                path: '/uploads/Tattoo/test.webp',
                category: 'Tattoo',
                type: 'image'
            });

            expect(media.tags).toEqual([]);
        });

        it('devrait accepter des tags', () => {
            const media = new Media({
                filename: 'test.webp',
                path: '/uploads/Tattoo/test.webp',
                category: 'Tattoo',
                type: 'image',
                tags: ['noir', 'blanc', 'geometrique']
            });

            expect(media.tags).toHaveLength(3);
            expect(media.tags).toContain('noir');
        });

        it('devrait avoir cloudUrl null par defaut', () => {
            const media = new Media({
                filename: 'test.webp',
                path: '/uploads/Tattoo/test.webp',
                category: 'Tattoo',
                type: 'image'
            });

            expect(media.cloudUrl).toBeNull();
        });

        it('devrait accepter une cloudUrl', () => {
            const cloudUrl = 'https://res.cloudinary.com/xxx/image/upload/v123/test.webp';
            const media = new Media({
                filename: 'test.webp',
                path: '/uploads/Tattoo/test.webp',
                category: 'Tattoo',
                type: 'image',
                cloudUrl
            });

            expect(media.cloudUrl).toBe(cloudUrl);
        });

        it('devrait trim les champs string', () => {
            const media = new Media({
                filename: '  test.webp  ',
                path: '  /uploads/Tattoo/test.webp  ',
                category: '  Tattoo  ',
                type: 'image'
            });

            expect(media.filename).toBe('test.webp');
            expect(media.path).toBe('/uploads/Tattoo/test.webp');
            expect(media.category).toBe('Tattoo');
        });
    });

    describe('Indexes', () => {
        it('devrait avoir les index definis', () => {
            const indexes = Media.schema.indexes();
            const indexKeys = indexes.map(([keys]) => Object.keys(keys).join('_'));

            expect(indexKeys).toContain('category');
            expect(indexKeys).toContain('type');
            expect(indexKeys).toContain('createdAt');
            expect(indexKeys).toContain('category_type');
            expect(indexKeys).toContain('filename');
        });
    });
});
