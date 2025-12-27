import mongoose, { Schema, Document, Model } from 'mongoose';
import { MediaType } from '../types';

export interface IMediaDocument extends Document {
    _id: mongoose.Types.ObjectId;
    filename: string;
    path: string;
    category: string;
    type: MediaType;
    tags: string[];
    cloudUrl: string | null;
    createdAt?: Date;
    updatedAt?: Date;
}

const mediaSchema = new Schema<IMediaDocument>(
    {
        filename: {
            type: String,
            required: true,
            trim: true,
        },
        path: {
            type: String,
            required: true,
            trim: true,
        },
        category: {
            type: String,
            required: true,
            trim: true,
        },
        type: {
            type: String,
            enum: ['image', 'video'] as MediaType[],
            required: true,
        },
        tags: {
            type: [String],
            default: [],
        },
        cloudUrl: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Index pour optimiser les requêtes fréquentes
mediaSchema.index({ category: 1 });
mediaSchema.index({ type: 1 });
mediaSchema.index({ createdAt: -1 });
mediaSchema.index({ category: 1, type: 1 });
mediaSchema.index({ filename: 1 });

const Media: Model<IMediaDocument> = mongoose.model<IMediaDocument>('Media', mediaSchema);

export default Media;
