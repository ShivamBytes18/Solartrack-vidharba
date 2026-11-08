import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../models.js';
import { requireAuth, sign } from '../auth.js';
import { wrap } from '../lib/http.js';

const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, message: { error: 'Too many sign-in attempts. Try again later.' } });
const body = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });

router.post('/login', limiter, wrap(async (req, res) => {
  const { email, password } = body.parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Email or password is not correct.' });
  res.json({ token: sign(user), user: { name: user.name, role: user.role } });
}));

router.get('/me', requireAuth, (req, res) => res.json({ name: req.user.name, role: req.user.role }));
export default router;
