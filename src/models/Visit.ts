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
            maxlength: 200,
        },
        // Empreinte pseudonymisée de l'IP (jamais l'IP en clair)
        ip: {
            type: String,
            required: true,
            maxlength: 64,
        },
        userAgent: {
            type: String,
            default: '',
            maxlength: 512,
        },
        // Origine seule (ex : https://www.google.com), sans chemin ni paramètres
        referer: {
            type: String,
            default: '',
            maxlength: 200,
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
            maxlength: 64,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

// Durée de conservation : les visites sont supprimées automatiquement après 13 mois
export const VISIT_RETENTION_SECONDS = 395 * 24 * 60 * 60;
visitSchema.index({ createdAt: 1 }, { expireAfterSeconds: VISIT_RETENTION_SECONDS });

// Index pour optimiser les requêtes d'analytics
visitSchema.index({ createdAt: -1 });
visitSchema.index({ page: 1, createdAt: -1 });
visitSchema.index({ ip: 1, createdAt: -1 });
visitSchema.index({ device: 1 });

const Visit: Model<IVisitDocument> = mongoose.model<IVisitDocument>('Visit', visitSchema);

export default Visit;
