import mongoose, { Schema, Document, Model } from 'mongoose';

export type ReservationStatus = 'en attente' | 'acceptée' | 'refusée' | 'terminée';

export interface IReservationDocument extends Document {
    _id: mongoose.Types.ObjectId;
    name: string;
    email: string;
    message: string;
    date: Date;
    status: ReservationStatus;
    createdAt?: Date;
    updatedAt?: Date;
}

const reservationSchema = new Schema<IReservationDocument>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        message: {
            type: String,
            default: '',
            trim: true,
        },
        date: {
            type: Date,
            required: true,
        },
        status: {
            type: String,
            enum: ['en attente', 'acceptée', 'refusée', 'terminée'] as ReservationStatus[],
            default: 'en attente',
        },
    },
    {
        timestamps: true,
    }
);

// Index pour optimiser les requêtes fréquentes
reservationSchema.index({ status: 1 });
reservationSchema.index({ createdAt: -1 });
reservationSchema.index({ date: 1 });
reservationSchema.index({ email: 1 });

const Reservation: Model<IReservationDocument> = mongoose.model<IReservationDocument>('Reservation', reservationSchema);

export default Reservation;
