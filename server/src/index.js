import mongoose from 'mongoose';
import { config } from './config.js';
import { createApp } from './app.js';
import { seed } from './seed.js';
import { User } from './models.js';

if (!config.mongoUri) throw new Error('MONGODB_URI is not set');
if (!config.jwtSecret || config.jwtSecret.length < 16) throw new Error('JWT_SECRET must be set (16+ characters)');

await mongoose.connect(config.mongoUri);
if (config.autoSeed && (await User.countDocuments()) === 0) await seed();
createApp().listen(config.port, () => console.log(`API on :${config.port}`));
