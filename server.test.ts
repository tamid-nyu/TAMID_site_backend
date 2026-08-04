import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { importFreshApp, importFreshServerModule } from './test/helpers/http.js';

interface HealthResponseBody {
  supabase: unknown;
}

describe('server shared behavior', () => {
  it('serves root metadata, health, OpenAPI JSON, and favicon responses', async () => {
    const app = await importFreshApp();

    const root = await request(app).get('/').expect(200);
    expect(root.body).toMatchObject({
      name: 'TAMID API',
      status: 'running',
      endpoints: {
        health: '/health',
        api: '/v1',
        openapi: '/docs.json',
      },
    });

    const health = await request(app).get('/health').expect(200);
    expect(health.body).toMatchObject({
      status: 'healthy',
      environment: 'test',
      supabase: {
        url: 'http://127.0.0.1:54321',
        projectRef: 'local',
        environment: 'local',
        isProduction: false,
      },
    });
    expect(typeof (health.body as { timestamp: unknown }).timestamp).toBe('string');

    const docs = await request(app).get('/docs.json').expect(200);
    expect(docs.body).toMatchObject({
      openapi: expect.stringMatching(/^3\./),
      info: expect.objectContaining({ title: expect.any(String) }),
    });

    await request(app).get('/favicon.ico').expect(204);
    await request(app).get('/favicon.png').expect(204);
  });

  it('returns the public API version payload under /v1', async () => {
    const app = await importFreshApp();

    await request(app)
      .get('/v1')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          version: '1.0.0',
          documentation: '/docs',
        });
      });
  });

  it('reports production Supabase metadata as unsafe on /health', async () => {
    const app = await importFreshApp({
      supabaseUrl: 'https://ggpcovdlthmysfouulpq.supabase.co',
    });

    await request(app)
      .get('/health')
      .expect(200)
      .expect(({ body }) => {
        expect((body as HealthResponseBody).supabase).toEqual({
          url: 'https://ggpcovdlthmysfouulpq.supabase.co',
          projectRef: 'ggpcovdlthmysfouulpq',
          environment: 'production',
          isProduction: true,
        });
      });
  });

  it('reports missing Supabase URL as unsafe on /health', async () => {
    const app = await importFreshApp({ supabaseUrl: null });

    await request(app)
      .get('/health')
      .expect(200)
      .expect(({ body }) => {
        expect((body as HealthResponseBody).supabase).toEqual({
          url: null,
          projectRef: 'unknown',
          environment: 'unknown',
          isProduction: true,
        });
      });
  });

  it('reports malformed Supabase URL as unsafe on /health', async () => {
    const app = await importFreshApp({ supabaseUrl: 'not a url' });

    await request(app)
      .get('/health')
      .expect(200)
      .expect(({ body }) => {
        expect((body as HealthResponseBody).supabase).toEqual({
          url: 'not a url',
          projectRef: 'unknown',
          environment: 'unknown',
          isProduction: true,
        });
      });
  });

  it('allows local admin origin to call /health', async () => {
    const app = await importFreshApp();

    await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5174')
      .expect(200)
      .expect((response) => {
        const headers = (response as unknown as { headers: Record<string, string | undefined> })
          .headers;
        expect(headers['access-control-allow-origin']).toBe('http://localhost:5174');
      });
  });

  it('includes Supabase target environment in startup log metadata', async () => {
    const { getStartupLogMetadata } = await importFreshServerModule();

    expect(getStartupLogMetadata(3000)).toMatchObject({
      message: 'TAMID Backend server running on port 3000',
      database: 'Supabase PostgreSQL',
      dbEnvironment: 'local',
      healthCheck: 'http://localhost:3000/health',
    });
  });

  it('maps unknown routes through the JSON 404 error handler', async () => {
    const app = await importFreshApp();

    await request(app)
      .get('/missing')
      .expect(404)
      .expect(({ body }) => {
        expect(body).toEqual({
          success: false,
          error: {
            message: 'Not found - /missing',
            code: 'NOT_FOUND',
          },
        });
      });
  });

  it('maps blocked CORS origins through the error handler', async () => {
    const app = await importFreshApp();

    await request(app)
      .get('/health')
      .set('Origin', 'https://evil.example')
      .expect(403)
      .expect(({ body }) => {
        expect(body).toEqual({
          success: false,
          error: {
            message: 'CORS policy violation',
            code: 'CORS_ERROR',
          },
        });
      });
  });

  it('rejects invalid referers on shared /v1 routes outside development', async () => {
    const app = await importFreshApp();

    await request(app)
      .get('/v1')
      .set('Referer', 'https://evil.example/page')
      .expect(403)
      .expect(({ body }) => {
        expect(body).toEqual({
          success: false,
          error: {
            message: 'Forbidden - Invalid referer',
            code: 'INVALID_REFERER',
          },
        });
      });
  });

  it('can force rate limiting for /v1 routes in tests', async () => {
    const app = await importFreshApp({ enableRateLimit: true });

    for (let requestCount = 0; requestCount < 100; requestCount += 1) {
      await request(app).get('/v1').expect(200);
    }

    await request(app)
      .get('/v1')
      .expect(429)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: 'Too many requests from this IP, please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
        });
      });
  });
});
