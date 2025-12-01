/**
 * SILO BACKEND
 * Restaurant Operating System - API Server
 * 
 * Architecture: Internal Microservices
 * All services communicate via direct function calls (not HTTP)
 */

import express from 'express';
import cors from 'cors';
import { env, corsOrigins } from './config/env';
import { testConnection } from './config/database';
import apiRouter from './api';
import { notFoundHandler, errorHandler } from './middleware/error.middleware';

const app = express();

// ============ MIDDLEWARE ============

// CORS
app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

// Body parsing - increased limit for image uploads (base64 encoded)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (development)
if (env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ============ ROUTES ============

// API routes
app.use('/api', apiRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Silo Backend API',
    version: '1.0.0',
    status: 'running',
    docs: '/api/health',
  });
});

// ============ ERROR HANDLING ============

app.use(notFoundHandler);
app.use(errorHandler);

// ============ START SERVER ============

async function start() {
  console.log('');
  console.log('🚀 Starting Silo Backend...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Test database connection
  const dbConnected = await testConnection();
  if (dbConnected) {
    console.log('✅ Database connected');
  } else {
    console.log('⚠️  Database connection failed (will retry on requests)');
  }

  // Start server
  app.listen(parseInt(env.PORT), () => {
    console.log(`✅ Server running on port ${env.PORT}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📍 Endpoints:');
    console.log(`   API:    http://localhost:${env.PORT}/api`);
    console.log(`   Health: http://localhost:${env.PORT}/api/health`);
    console.log('');
    console.log('🔧 Services:');
    console.log('   • Auth          - /api/auth (SuperAdmin)');
    console.log('   • Business Auth - /api/business-auth (Business App)');
    console.log('   • Businesses    - /api/businesses');
    console.log('   • POS           - /api/pos');
    console.log('   • Inventory     - /api/inventory');
    console.log('   • HR            - /api/hr (coming soon)');
    console.log('   • Operations    - /api/operations (coming soon)');
    console.log('');
  });
}

start().catch(console.error);

export default app;

