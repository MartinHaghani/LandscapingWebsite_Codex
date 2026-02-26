import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { contactRouter } from './routes/contact.js';
import { quoteRouter } from './routes/quote.js';

export const createApp = (clientOrigin: string) => {
  const app = express();

  const limiter = rateLimit({
    windowMs: 60_000,
    max: 45,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again shortly.' }
  });

  const writeLimiter = rateLimit({
    windowMs: 60_000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit reached for submissions. Please retry in a minute.' }
  });

  app.use(cors({ origin: clientOrigin }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', limiter);

  app.get('/', (_req, res) => {
    res.json({
      ok: true,
      message: 'Autoscape API is running.',
      frontend: clientOrigin,
      health: '/api/health'
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'autoscape-server' });
  });

  app.use('/api/quote', writeLimiter, quoteRouter);
  app.use('/api/contact', writeLimiter, contactRouter);

  return app;
};
