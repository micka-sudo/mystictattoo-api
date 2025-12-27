import { Router } from 'express';
import authRouter from './auth';
import mediaRouter from './media';
import newsRouter from './news';
import reservationRouter from './reservation';
import configRouter from './config';
import statsRouter from './stats';

const router = Router();

router.use('/login', authRouter);
router.use('/media', mediaRouter);
router.use('/news', newsRouter);
router.use('/reservations', reservationRouter);
router.use('/config', configRouter);
router.use('/stats', statsRouter);

export default router;
