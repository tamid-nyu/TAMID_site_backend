import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';

const upload = jest.fn<(...args: unknown[]) => Promise<{ data: unknown; error: unknown }>>();
const getPublicUrl = jest.fn((path: string) => ({
  data: { publicUrl: `https://storage.example/board-headshots/${path}` },
}));
const selectExisting = jest.fn();
const updateBoardMember = jest.fn();

const boardMemberRow = {
  id: 'dbc59546-fdd5-48f5-81ff-c1ec6e5efde9',
  full_name: 'Ada Lovelace',
  position: 'President',
  bio: 'Bio',
  major: 'Finance',
  year: '2027',
  hometown: 'New York, NY',
  linkedin_url: null,
  email: 'ada@example.com',
  headshot_file: 'dbc59546-fdd5-48f5-81ff-c1ec6e5efde9.webp',
  headshot_updated_at: '2026-07-22T16:00:00.000Z',
  order_index: 1,
};

const chain = (result: unknown) => {
  const query = {
    select: jest.fn(),
    update: updateBoardMember,
    eq: jest.fn(),
    single: jest.fn(() => Promise.resolve(result)),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
};

const existingQuery = chain({ data: { id: boardMemberRow.id }, error: null });
const updateQuery = chain({ data: boardMemberRow, error: null });
selectExisting.mockReturnValue(existingQuery);
updateBoardMember.mockReturnValue(updateQuery);

const from = jest.fn(() => ({
  select: selectExisting,
  update: updateBoardMember,
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
    params: { id: boardMemberRow.id },
    body: {
      fullSize: {
        path: `${boardMemberRow.id}.webp`,
        contentBase64: Buffer.from('full-size').toString('base64'),
        contentType: 'image/jpeg',
      },
      thumbnail: {
        path: `thumbnails/${boardMemberRow.id}.jpg`,
        contentBase64: Buffer.from('thumbnail').toString('base64'),
        contentType: 'image/jpeg',
      },
    },
  }) as unknown as Request<Record<string, string>, unknown, TestReplacementBody>;

describe('board member headshot replacement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    selectExisting.mockReturnValue(existingQuery);
    updateBoardMember.mockReturnValue(updateQuery);
    upload.mockResolvedValue({ data: {}, error: null });
  });

  it('uses the same two-upload then version-update flow as event flyers', async () => {
    const { replaceBoardMemberHeadshotHandler } = await import('./boardMemberHeadshot.js');
    const response = createResponse();

    await replaceBoardMemberHeadshotHandler(createRequest(), response);

    expect(upload).toHaveBeenNthCalledWith(
      1,
      `${boardMemberRow.id}.webp`,
      Buffer.from('full-size'),
      {
        cacheControl: '31536000',
        contentType: 'image/jpeg',
        upsert: true,
      }
    );
    expect(upload).toHaveBeenNthCalledWith(
      2,
      `thumbnails/${boardMemberRow.id}.jpg`,
      Buffer.from('thumbnail'),
      {
        cacheControl: '31536000',
        contentType: 'image/jpeg',
        upsert: true,
      }
    );
    expect(updateBoardMember).toHaveBeenCalledWith({
      headshot_file: `${boardMemberRow.id}.webp`,
      headshot_updated_at: expect.any(String),
    });
    expect(upload.mock.invocationCallOrder[1]).toBeLessThan(
      updateBoardMember.mock.invocationCallOrder[0]
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          boardMember: expect.objectContaining({
            headshotFile: `${boardMemberRow.id}.webp`,
            headshotUpdatedAt: boardMemberRow.headshot_updated_at,
          }),
          headshot: expect.objectContaining({
            fullSizeUrl: expect.stringContaining(
              `v=${encodeURIComponent(boardMemberRow.headshot_updated_at)}`
            ),
            thumbnailUrl: expect.stringContaining(
              `v=${encodeURIComponent(boardMemberRow.headshot_updated_at)}`
            ),
          }),
        }),
      })
    );
  });

  it('does not update the board member row when the thumbnail upload fails', async () => {
    const { replaceBoardMemberHeadshotHandler } = await import('./boardMemberHeadshot.js');
    upload
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'upload failed' } });

    await expect(
      replaceBoardMemberHeadshotHandler(createRequest(), createResponse())
    ).rejects.toThrow('Failed to upload board member headshot thumbnail');

    expect(updateBoardMember).not.toHaveBeenCalled();
  });

  it('requires the deterministic thumbnail path used by public clients', async () => {
    const { replaceBoardMemberHeadshotHandler } = await import('./boardMemberHeadshot.js');
    const request = createRequest();
    request.body.thumbnail.path = `thumbnails/${boardMemberRow.id}-small.jpg`;
    const response = createResponse();

    await replaceBoardMemberHeadshotHandler(request, response);

    expect(upload).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      error: {
        message: `thumbnail.path must be exactly thumbnails/${boardMemberRow.id}.jpg`,
        code: 'VALIDATION_ERROR',
      },
    });
  });

  it('derives the canonical thumbnail path from the owning row ID', async () => {
    const { getThumbnailPath } = await import('./versionedImageReplacement.js');

    expect(getThumbnailPath(boardMemberRow.id)).toBe(`thumbnails/${boardMemberRow.id}.jpg`);
  });

  it('requires JPEG thumbnail content', async () => {
    const { replaceBoardMemberHeadshotHandler } = await import('./boardMemberHeadshot.js');
    const request = createRequest();
    request.body.thumbnail.contentType = 'image/webp';
    const response = createResponse();

    await replaceBoardMemberHeadshotHandler(request, response);

    expect(upload).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      error: {
        message: 'thumbnail.contentType must be image/jpeg',
        code: 'VALIDATION_ERROR',
      },
    });
  });

  it.each([(id: string) => `members/${id}.png`, (id: string) => `board-headshots/${id}.png`])(
    'rejects legacy and bucket-prefixed full-size paths',
    async (makePath) => {
      const { replaceBoardMemberHeadshotHandler } = await import('./boardMemberHeadshot.js');
      const request = createRequest();
      request.body.fullSize.path = makePath(boardMemberRow.id);
      const response = createResponse();

      await replaceBoardMemberHeadshotHandler(request, response);

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
});
