import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Trust proxy for proper origin/host detection in containerized environments.
 * Essential for Docker, Kubernetes, and reverse proxies (nginx, Cloudflare, etc.)
 */
app.set('trust proxy', true);

/**
 * Middleware: Ensure proper host detection for Angular SSRF protection.
 * Sets the HOST header from X-Forwarded-Host (used by proxies) or constructs from origin.
 */
app.use((req, res, next) => {
  // If X-Forwarded-Host exists (from proxy), use it as the canonical host
  if (req.get('x-forwarded-host')) {
    req.headers['host'] = req.get('x-forwarded-host') ?? req.headers['host'];
  }

  // For Docker: ensure ORIGIN environment variable is set for Angular SSR
  // This tells Angular what the canonical origin is for SSRF validation
  if (!process.env['ORIGIN']) {
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    const host = req.get('host') || `localhost:${process.env['PORT'] || 4000}`;
    process.env['ORIGIN'] = `${protocol}://${host}`;
  }

  next();
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
