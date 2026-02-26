import { Router } from 'express';
import { nanoid } from 'nanoid';
import { contactPayloadSchema } from '../lib/schemas.js';
import { store } from '../lib/store.js';

export const contactRouter = Router();

contactRouter.post('/', (req, res) => {
  const parsed = contactPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid contact payload.',
      details: parsed.error.flatten()
    });
  }

  const payload = parsed.data;
  const id = nanoid(10);

  const contact = store.saveContact({
    id,
    createdAt: new Date().toISOString(),
    name: payload.name,
    email: payload.email,
    message: payload.message
  });

  return res.status(201).json({ ok: true, id: contact.id });
});
