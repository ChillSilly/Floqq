import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { router as apiRouter } from './api/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Debug logging
  app.use((req, res, next) => {
    console.log(`[Elite Terminal] ${req.method} ${req.url}`);
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'active', platform: 'Elite Terminal', timestamp: new Date().toISOString() });
  });

  app.get('/api/test-direct', (req, res) => {
    res.json({ message: 'direct success' });
  });

  // Mount API router
  app.use('/api', apiRouter);

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('[Fatal Error]', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Elite Terminal] Server active at http://0.0.0.0:${PORT}`);
    console.log(`[Elite Terminal] Mode: ${process.env.NODE_ENV || 'development'}`);
  });
}

console.log('[Elite Terminal] Starting application server...');
startServer().catch(err => {
  console.error('[Fatal Start Error]', err);
  process.exit(1);
});
