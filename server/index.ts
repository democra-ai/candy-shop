// ============================================================
// Candy Shop Payment Server
// Express API: Stripe checkout + webhook + x402 protocol
// ============================================================

import express from 'express';
import cors from 'cors';
import { paymentRouter } from './routes/payment.js';
import { x402Router } from './routes/x402.js';
import { webhookRouter } from './routes/webhook.js';
import { invokeRouter } from './routes/invoke.js';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS for frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Webhook route needs raw body for Stripe signature verification
// Must be registered BEFORE express.json()
app.use('/api/webhook', webhookRouter);

// JSON parsing for all other routes
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    providers: {
      stripe: !!process.env.STRIPE_SECRET_KEY,
      x402: !!process.env.X402_RECEIVER_ADDRESS,
    },
    timestamp: new Date().toISOString(),
  });
});

// Payment routes
app.use('/api/payment', paymentRouter);

// x402 protocol routes
app.use('/api/x402', x402Router);

// Skill invocation routes (execution rights gateway)
app.use('/api/invoke', invokeRouter);

app.listen(PORT, () => {
  console.log(`🍬 Candy Shop Payment Server running on port ${PORT}`);
  console.log(`   Stripe: ${process.env.STRIPE_SECRET_KEY ? 'configured' : 'not configured (set STRIPE_SECRET_KEY)'}`);
  console.log(`   x402:   ${process.env.X402_RECEIVER_ADDRESS ? 'configured' : 'not configured (set X402_RECEIVER_ADDRESS)'}`);
});

export default app;
