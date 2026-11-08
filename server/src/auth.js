import jwt from 'jsonwebtoken';
import { config } from './config.js';

export const sign = (user) => jwt.sign({ sub: String(user._id), role: user.role, name: user.name }, config.jwtSecret, { expiresIn: '12h' });

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  try {
    const p = jwt.verify(header.replace(/^Bearer /, ''), config.jwtSecret);
    req.user = { id: p.sub, role: p.role, name: p.name };
    next();
  } catch {
    res.status(401).json({ error: 'Please sign in again.' });
  }
}

export const requireAdmin = (req, res, next) =>
  req.user?.role === 'admin' ? next() : res.status(403).json({ error: 'Only admins can do this.' });
