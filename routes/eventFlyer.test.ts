import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';

const upload = jest.fn<(...args: unknown[]) => Promise<{ data: unknown; error: unknown }>>();
const getPublicUrl = jest.fn((path: string) => ({
  data: { publicUrl: `https://storage.example/event-flyers/${path}` },
}));
const selectExisting = jest.fn();
const updateEvent = jest.fn();

const eventRow = {
  id: '9e8a83da-3590-45e5-8903-3ff721521a56',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-07-22T15:00:00.000Z',
  title: 'Finance Panel',
  company: 'Acme',
  start_time: '2026-08-01T18:00:00.000Z',
  end_time: '2026-08-01T19:00:00.000Z',
  location: 'KMC',
  flyer_file: '9e8a83da-3590-45e5-8903-3ff721521a56.webp',
  rsvp_link: null,
  description: null,
  is_visible: true,
  semester: 'F26',
};

const chain = (result: unknown) => {
  const query = {
    select: jest.fn(),
    update: updateEvent,
    eq: jest.fn(),
    single: jest.fn(() => Promise.resolve(result)),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
};

const existingQuery = chain({ data: { id: eventRow.id }, error: null });
const updateQuery = chain({ data: eventRow, error: null });
selectExisting.mockReturnValue(existingQuery);
updateEvent.mockReturnValue(updateQuery);

const from = jest.fn(() => ({
  select: selectExisting,
  update: updateEvent,
}));

jest.unstable_mockModule('../config/supabase.js', () => ({
  describeSupabaseError: (error: unknown) => String(error),
  getSupabase: jest.fn(),
  getSupabaseAdmin: () => ({
    from,
    storage: {
      from: jest.fn(() => ({ upload, getPublicUrl })),
    },
  }),
}));

const createResponse = () => {
  const response = {
    status: jest.fn<(status: number) => Response>(),
    json: jest.fn<(body: unknown) => Response>(),
  } as unknown as Response & {
    status: jest.Mock<(status: number) => Response>;
    json: jest.Mock<(body: unknown) => Response>;
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
};

interface TestReplacementBody {
  fullSize: { path: string; contentBase64: string; contentType: string };
  thumbnail: { path: string; contentBase64: string; contentType: string };
}

const createRequest = () =>
  ({
    params: { id: eventRow.id },
    body: {
      fullSize: {
        path: `${eventRow.id}.webp`,
        contentBase64: Buffer.from('full-size').toString('base64'),
        contentType: 'image/jpeg',
      },
      thumbnail: {
        path: `thumbnails/${eventRow.id}.jpg`,
        contentBase64: Buffer.from('thumbnail').toString('base64'),
        contentType: 'image/jpeg',
      },
    },
  }) as unknown as Request<Record<string, string>, unknown, TestReplacementBody>;

describe('event flyer replacement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    selectExisting.mockReturnValue(existingQuery);
    updateEvent.mockReturnValue(updateQuery);
    upload.mockResolvedValue({ data: {}, error: null });
  });

  it('uploads both variants before updating the event timestamp', async () => {
    const { replaceEventFlyerHandler } = await import('./eventFlyer.js');
    const response = createResponse();

    await replaceEventFlyerHandler(createRequest(), response);

    expect(upload).toHaveBeenNthCalledWith(1, `${eventRow.id}.webp`, Buffer.from('full-size'), {
      cacheControl: '31536000',
      contentType: 'image/jpeg',
      upsert: true,
    });
    expect(upload).toHaveBeenNthCalledWith(
      2,
      `thumbnails/${eventRow.id}.jpg`,
      Buffer.from('thumbnail'),
      {
        cacheControl: '31536000',
        contentType: 'image/jpeg',
        upsert: true,
      }
    );
    expect(updateEvent).toHaveBeenCalledWith({
      flyer_file: `${eventRow.id}.webp`,
      updated_at: expect.any(String),
    });
    expect(upload.mock.invocationCallOrder[1]).toBeLessThan(
      updateEvent.mock.invocationCallOrder[0]
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          event: expect.objectContaining({
            flyerFile: `${eventRow.id}.webp`,
            updatedAt: eventRow.updated_at,
          }),
          flyer: expect.objectContaining({
            fullSizeUrl: expect.stringContaining(`v=${encodeURIComponent(eventRow.updated_at)}`),
            thumbnailUrl: expect.stringContaining(`v=${encodeURIComponent(eventRow.updated_at)}`),
          }),
        }),
      })
    );
  });

  it('does not update the event row when the thumbnail upload fails', async () => {
    const { replaceEventFlyerHandler } = await import('./eventFlyer.js');
    upload
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'upload failed' } });

    await expect(replaceEventFlyerHandler(createRequest(), createResponse())).rejects.toThrow(
      'Failed to upload event flyer thumbnail'
    );

    expect(updateEvent).not.toHaveBeenCalled();
  });

  it.each([(id: string) => `events/${id}.png`, (id: string) => `event-flyers/${id}.png`])(
    'rejects a non-root full-size path',
    async (makePath) => {
      const { replaceEventFlyerHandler } = await import('./eventFlyer.js');
      const request = createRequest();
      request.body.fullSize.path = makePath(eventRow.id);
      const response = createResponse();

      await replaceEventFlyerHandler(request, response);

      expect(upload).not.toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'fullSize.path must be a root-level object path',
          code: 'VALIDATION_ERROR',
        },
      });
    }
  );

  it('rejects a full-size filename whose basename is not the event ID', async () => {
    const { replaceEventFlyerHandler } = await import('./eventFlyer.js');
    const request = createRequest();
    request.body.fullSize.path = 'finance-panel.png';
    const response = createResponse();

    await replaceEventFlyerHandler(request, response);

    expect(upload).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
  });
});
