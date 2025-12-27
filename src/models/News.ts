import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INewsDocument extends Document {
    _id: mongoose.Types.ObjectId;
    title: string;
    content: string;
    image: string;
    isVisible: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const newsSchema = new Schema<INewsDocument>(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        content: {
            type: String,
            required: true,
            trim: true,
        },
        image: {
            type: String,
            default: '',
        },
        isVisible: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

// Index pour les requêtes fréquentes
newsSchema.index({ isVisible: 1 });
newsSchema.index({ createdAt: -1 });

const News: Model<INewsDocument> = mongoose.model<INewsDocument>('News', newsSchema);

export default News;
