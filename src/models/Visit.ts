import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVisitDocument extends Document {
    _id: mongoose.Types.ObjectId;
    page: string;
    ip: string;
    userAgent: string;
    referer: string;
    country?: string;
    city?: string;
    device: 'mobile' | 'tablet' | 'desktop';
    browser?: string;
    sessionId?: string;
    createdAt?: Date;
}

const visitSchema = new Schema<IVisitDocument>(
    {
        page: {
            type: String,
            required: true,
            trim: true,
        },
        ip: {
            type: String,
            required: true,
        },
        userAgent: {
            type: String,
            default: '',
        },
        referer: {
            type: String,
            default: '',
        },
        country: {
            type: String,
            default: '',
        },
        city: {
            type: String,
            default: '',
        },
        device: {
            type: String,
            enum: ['mobile', 'tablet', 'desktop'],
            default: 'desktop',
        },
        browser: {
            type: String,
            default: '',
        },
        sessionId: {
            type: String,
            default: '',
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

// Index pour optimiser les requêtes d'analytics
visitSchema.index({ createdAt: -1 });
visitSchema.index({ page: 1, createdAt: -1 });
visitSchema.index({ ip: 1, createdAt: -1 });
visitSchema.index({ device: 1 });

const Visit: Model<IVisitDocument> = mongoose.model<IVisitDocument>('Visit', visitSchema);

export default Visit;
