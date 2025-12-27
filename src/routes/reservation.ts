import { Router, Request, Response } from 'express';
import verifyToken from '../middlewares/auth';
import Reservation, { ReservationStatus } from '../models/Reservation';
import { AuthenticatedRequest } from '../types';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_STATUSES: ReservationStatus[] = ['en attente', 'acceptée', 'refusée', 'terminée'];

// GET /reservation (admin uniquement)
router.get('/', verifyToken, async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const reservations = await Reservation.find().sort({ createdAt: -1 });
        res.json(reservations);
    } catch (err) {
        console.error('Erreur GET /reservation:', err);
        res.status(500).json({ error: 'Erreur lecture des réservations' });
    }
});

// POST /reservation (public)
router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, email, message, date } = req.body;

        if (!name || !email || !date) {
            res.status(400).json({ error: 'Champs requis manquants' });
            return;
        }

        if (!EMAIL_REGEX.test(email)) {
            res.status(400).json({ error: 'Format email invalide' });
            return;
        }

        const reservationDate = new Date(date);
        if (isNaN(reservationDate.getTime())) {
            res.status(400).json({ error: 'Format de date invalide' });
            return;
        }

        const newReservation = new Reservation({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            message: (message || '').trim(),
            date: reservationDate,
            status: 'en attente',
        });

        await newReservation.save();

        res.status(201).json(newReservation);
    } catch (err) {
        console.error('Erreur POST /reservation:', err);
        res.status(500).json({ error: 'Erreur création réservation' });
    }
});

// PUT /reservation/:id (admin uniquement)
router.put('/:id', verifyToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            res.status(400).json({ error: 'Statut requis' });
            return;
        }

        if (!VALID_STATUSES.includes(status)) {
            res.status(400).json({ error: 'Statut invalide' });
            return;
        }

        const reservation = await Reservation.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!reservation) {
            res.status(404).json({ error: 'Réservation non trouvée' });
            return;
        }

        res.json(reservation);
    } catch (err) {
        console.error('Erreur PUT /reservation:', err);
        res.status(500).json({ error: 'Erreur mise à jour réservation' });
    }
});

// DELETE /reservation/:id (admin uniquement)
router.delete('/:id', verifyToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const reservation = await Reservation.findByIdAndDelete(id);

        if (!reservation) {
            res.status(404).json({ error: 'Réservation non trouvée' });
            return;
        }

        res.json(reservation);
    } catch (err) {
        console.error('Erreur DELETE /reservation:', err);
        res.status(500).json({ error: 'Erreur suppression réservation' });
    }
});

export default router;
