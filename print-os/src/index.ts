// =====================================================================
// PRINT OS — API Server Entry Point
// Hono on Node.js — Production-ready
// =====================================================================

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import quotation from './routes/quotation';
import salesOrder from './routes/salesOrder';
import production from './routes/production';
import dashboard from './routes/dashboard';
import customer from './routes/customer';

const app = new Hono();

// =====================================================================
// Middleware
// =====================================================================
app.use('*', logger());
app.use('*', cors({
  origin: (origin) => origin || '*',
  credentials: true,
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// =====================================================================
// Health check (no auth)
// =====================================================================
app.get('/', (c) => c.json({
  name: 'PRINT OS API',
  version: '1.0.0',
  status: 'ok',
  timestamp: new Date().toISOString(),
}));

app.get('/health', (c) => c.json({
  status: 'healthy',
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
}));

// =====================================================================
// API routes (with auth)
// =====================================================================
app.route('/api/v1/quotations', quotation);
app.route('/api/v1/sales-orders', salesOrder);
app.route('/api/v1/production', production);
app.route('/api/v1/dashboard', dashboard);
app.route('/api/v1/customers', customer);

// =====================================================================
// 404 handler
// =====================================================================
app.notFound((c) => c.json({ error: 'Not found', path: c.req.path }, 404));

// =====================================================================
// Error handler
// =====================================================================
app.onError((err, c) => {
  console.error('[API Error]', err);
  return c.json({ error: 'Internal server error', message: err.message }, 500);
});

// =====================================================================
// Start server
// =====================================================================
const port = parseInt(process.env.PORT || '3000');

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`\n🚀 PRINT OS API running on port ${info.port}`);
  console.log(`   Health: http://localhost:${info.port}/health`);
  console.log(`   Base:   http://localhost:${info.port}/api/v1`);
  console.log(`   Mode:   ${process.env.NODE_ENV || 'development'}\n`);
});

export default app;
