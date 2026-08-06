import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';

const bulkCreate = jest.fn<(rows: unknown[]) => Promise<unknown>>();

const buildApp = async () => {
  const { default: router } = (await import('./members.js')) as { default: express.Router };
  const { errorHandler } = await import('../middleware/errorHandler.js');
  const app = express();
  app.use(express.json());
  app.use('/v1/members', router);
  app.use(errorHandler as (err: Error, req: Request, res: Response, next: NextFunction) => void);
  return app;
};

describe('POST /v1/members/bulk', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.unstable_mockModule('../logger.js', () => ({
      logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
    }));
    jest.unstable_mockModule('../middleware/index.js', () => ({
      asyncHandler:
        (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
        (req: Request, res: Response, next: NextFunction) => {
          Promise.resolve(handler(req, res, next)).catch(next);
        },
      requireAdminUser: (_req: Request, _res: Response, next: NextFunction) => next(),
      validateInput: (_req: Request, _res: Response, next: NextFunction) => next(),
    }));
    jest.unstable_mockModule('../models/index.js', () => ({
      Member: { bulkCreate },
    }));
  });

  it('returns the summary for a valid request', async () => {
    bulkCreate.mockResolvedValue({ created: 2, skipped: 1, errors: [{ row: 3, message: 'bad' }] });
    const app = await buildApp();

    await request(app)
      .post('/v1/members/bulk')
      .send({
        members: [
          { first_name: 'A', last_name: 'B', semester: 'F26' },
          { first_name: 'C', last_name: 'D', semester: 'F26' },
        ],
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          success: true,
          data: { created: 2, skipped: 1, errors: [{ row: 3, message: 'bad' }] },
        });
      });
  });

  it('rejects a body without a members array', async () => {
    const app = await buildApp();
    await request(app).post('/v1/members/bulk').send({}).expect(400);
    expect(bulkCreate).not.toHaveBeenCalled();
  });

  it('rejects an empty members array', async () => {
    const app = await buildApp();
    await request(app).post('/v1/members/bulk').send({ members: [] }).expect(400);
    expect(bulkCreate).not.toHaveBeenCalled();
  });
});
