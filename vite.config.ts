import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // So server-side API can use Gemini (process.env is for Node, define is for client)
    if (env.GEMINI_API_KEY) {
      process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
      process.env.API_KEY = env.GEMINI_API_KEY;
    }
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        {
          name: 'api-process-receipt',
          configureServer(server) {
            server.middlewares.use((req, res, next) => {
              if (req.url !== '/api/process-receipt' || req.method !== 'POST') {
                return next();
              }
              const chunks: Buffer[] = [];
              req.on('data', (chunk: Buffer) => chunks.push(chunk));
              req.on('end', () => {
                (async () => {
                  let body: { base64Image?: string; mimeType?: string } = {};
                  try {
                    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                  } catch {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
                    return;
                  }
                  const { base64Image, mimeType } = body;
                  if (!base64Image || !mimeType) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'Missing base64Image or mimeType' }));
                    return;
                  }
                  try {
                    const { processReceiptImage } = await import('./services/geminiService');
                    const items = await processReceiptImage(base64Image, mimeType);
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(items));
                  } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'Receipt processing failed', details: message }));
                  }
                })();
              });
            });
          },
        },
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
