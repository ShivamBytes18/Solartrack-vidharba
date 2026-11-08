import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  geminiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  geminiFallbackModel: process.env.GEMINI_FALLBACK_MODEL, // optional backup, e.g. gemini-3.5-flash-lite
  autoSeed: process.env.AUTO_SEED === 'true',
  seedPassword: process.env.SEED_PASSWORD || 'Demo@1234',
  isProd: process.env.NODE_ENV === 'production',
};
