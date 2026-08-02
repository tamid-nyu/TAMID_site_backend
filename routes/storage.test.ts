import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';

const listBuckets = jest.fn<() => Promise<unknown>>();
const listObjects = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const uploadObject = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const updateObject = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const moveObject = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const removeObjects = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const getPublicUrl = jest.fn<(path: string) => unknown>();
const fromBucket = jest.fn<(bucketId: string) => unknown>();

jest.unstable_mockModule('../config/supabase.js', () => ({
  describeSupabaseError: (error: unknown) => String(error),
  getSupabaseAdmin: () => ({
    storage: {
      listBuckets,
      from: fromBucket,
    },
  }),
}));

jest.unstable_mockModule('../middleware/index.js', () => ({
  asyncHandler: (handler: unknown) => handler,
  requireAdminUser: function requireAdminUser(_req: Request, _res: Response, next: () => void) {
    next();
  },
  validateInput: function validateInput(_req: Request, _res: Response, next: () => void) {
    next();
  },
}));

const getRouteSurface = (router: unknown): Array<{ path: string; methods: string[] }> => {
  const stack = (
    router as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }
  ).stack;

  return stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route!.path,
      methods: Object.entries(layer.route!.methods)
        .filter(([, enabled]) => enabled)
        .map(([method]) => method),
    }));
};

const getRouteHandler = async (
  path: string,
  method: string
): Promise<(req: Request, res: Response) => Promise<void> | void> => {
  const { default: storageRoutes } = await import('./storage.js');
  const routeLayer = (
    storageRoutes as {
      stack: Array<{
        route?: {
          path: string;
          methods: Record<string, boolean>;
          stack: Array<{ handle: (req: Request, res: Response) => Promise<void> | void }>;
        };
      }>;
    }
  ).stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);

  if (!routeLayer?.route) {
    throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  }

  return routeLayer.route.stack.at(-1)!.handle;
};

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

const createRequest = ({
  params = {},
  query = {},
  body = {},
}: {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
}) =>
  ({
    params,
    query,
    body,
  }) as unknown as Request;

describe('admin storage routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fromBucket.mockReturnValue({
      list: listObjects,
      upload: uploadObject,
      update: updateObject,
      move: moveObject,
      remove: removeObjects,
      getPublicUrl,
    });
    getPublicUrl.mockImplementation((path: string) => ({
      data: { publicUrl: `https://storage.example/${path}` },
    }));
  });

  it('defines bucket and object management routes for admins', async () => {
    const { default: storageRoutes } = await import('./storage.js');
    const routeSurface = getRouteSurface(storageRoutes);

    expect(routeSurface).toEqual([
      { path: '/buckets', methods: ['get'] },
      { path: '/buckets/:bucketId/objects', methods: ['get'] },
      { path: '/buckets/:bucketId/objects', methods: ['post'] },
      { path: '/buckets/:bucketId/objects', methods: ['put'] },
      { path: '/buckets/:bucketId/objects', methods: ['delete'] },
    ]);
  });

  it('lists all buckets for admins', async () => {
    listBuckets.mockResolvedValue({
      data: [
        { id: 'board-headshots', name: 'board-headshots', public: true },
        { id: 'event-flyers', name: 'event-flyers', public: true },
        { id: 'private-bucket', name: 'private-bucket', public: false },
      ],
      error: null,
    });
    const handler = await getRouteHandler('/buckets', 'get');
    const response = createResponse();

    await handler(createRequest({}), response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      count: 3,
      data: [
        { id: 'board-headshots', name: 'board-headshots', public: true },
        { id: 'event-flyers', name: 'event-flyers', public: true },
        { id: 'private-bucket', name: 'private-bucket', public: false },
      ],
    });
  });

  it('lists bucket objects with full paths and public URLs', async () => {
    listObjects.mockResolvedValue({
      data: [
        { name: 'headshot.jpg', id: 'file-id', metadata: { size: 12 } },
        { name: 'archive', id: null, metadata: null },
      ],
      error: null,
    });
    const handler = await getRouteHandler('/buckets/:bucketId/objects', 'get');
    const response = createResponse();

    await handler(
      createRequest({
        params: { bucketId: 'board-headshots' },
        query: { prefix: 'members' },
      }),
      response
    );

    expect(fromBucket).toHaveBeenCalledWith('board-headshots');
    expect(listObjects).toHaveBeenCalledWith('members', {
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      count: 2,
      data: [
        {
          name: 'headshot.jpg',
          path: 'members/headshot.jpg',
          type: 'file',
          metadata: { size: 12 },
          publicUrl: 'https://storage.example/members/headshot.jpg',
        },
        {
          name: 'archive',
          path: 'members/archive',
          type: 'folder',
          metadata: null,
        },
      ],
    });
  });

  it('uploads a new bucket object', async () => {
    uploadObject.mockResolvedValue({ data: { path: 'members/headshot.jpg' }, error: null });
    const handler = await getRouteHandler('/buckets/:bucketId/objects', 'post');
    const response = createResponse();

    await handler(
      createRequest({
        params: { bucketId: 'board-headshots' },
        body: {
          path: 'members/headshot.jpg',
          contentBase64: Buffer.from('image-bytes').toString('base64'),
          contentType: 'image/jpeg',
          cacheControl: '3600',
        },
      }),
      response
    );

    expect(uploadObject).toHaveBeenCalledWith('members/headshot.jpg', Buffer.from('image-bytes'), {
      cacheControl: '3600',
      contentType: 'image/jpeg',
      upsert: false,
    });
    expect(response.status).toHaveBeenCalledWith(201);
  });

  it('replaces an existing bucket object', async () => {
    updateObject.mockResolvedValue({ data: { path: 'members/headshot.jpg' }, error: null });
    const handler = await getRouteHandler('/buckets/:bucketId/objects', 'put');
    const response = createResponse();

    await handler(
      createRequest({
        params: { bucketId: 'private-bucket' },
        body: {
          path: 'members/headshot.jpg',
          contentBase64: Buffer.from('new-bytes').toString('base64'),
          contentType: 'image/jpeg',
        },
      }),
      response
    );

    expect(updateObject).toHaveBeenCalledWith('members/headshot.jpg', Buffer.from('new-bytes'), {
      contentType: 'image/jpeg',
    });
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('requires the coordinated workflow to replace event flyers', async () => {
    const handler = await getRouteHandler('/buckets/:bucketId/objects', 'put');
    const response = createResponse();

    await handler(
      createRequest({
        params: { bucketId: 'event-flyers' },
        body: {
          path: 'events/panel.jpg',
          contentBase64: Buffer.from('new-bytes').toString('base64'),
          contentType: 'image/jpeg',
        },
      }),
      response
    );

    expect(updateObject).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      error: {
        message: 'Replace objects in event-flyers through PUT /v1/events/:id/flyer',
        code: 'VERSIONED_IMAGE_WORKFLOW_REQUIRED',
      },
    });
  });

  it('rejects upload-with-upsert for event flyers', async () => {
    const handler = await getRouteHandler('/buckets/:bucketId/objects', 'post');
    const response = createResponse();

    await handler(
      createRequest({
        params: { bucketId: 'event-flyers' },
        body: {
          path: 'events/panel.jpg',
          contentBase64: Buffer.from('new-bytes').toString('base64'),
          contentType: 'image/jpeg',
          upsert: true,
        },
      }),
      response
    );

    expect(uploadObject).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it('requires the coordinated workflow to replace board headshots', async () => {
    const handler = await getRouteHandler('/buckets/:bucketId/objects', 'put');
    const response = createResponse();

    await handler(
      createRequest({
        params: { bucketId: 'board-headshots' },
        body: {
          path: 'members/ada.jpg',
          contentBase64: Buffer.from('new-bytes').toString('base64'),
          contentType: 'image/jpeg',
        },
      }),
      response
    );

    expect(updateObject).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      error: {
        message: 'Replace objects in board-headshots through PUT /v1/board-members/:id/headshot',
        code: 'VERSIONED_IMAGE_WORKFLOW_REQUIRED',
      },
    });
  });

  it('renames a bucket object', async () => {
    moveObject.mockResolvedValue({ data: { path: 'members/new.jpg' }, error: null });
    const handler = await getRouteHandler('/buckets/:bucketId/objects', 'put');
    const response = createResponse();

    await handler(
      createRequest({
        params: { bucketId: 'private-bucket' },
        body: {
          path: 'members/old.jpg',
          newPath: 'members/new.jpg',
        },
      }),
      response
    );

    expect(moveObject).toHaveBeenCalledWith('members/old.jpg', 'members/new.jpg');
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('deletes bucket objects', async () => {
    removeObjects.mockResolvedValue({ data: [{ name: 'members/headshot.jpg' }], error: null });
    const handler = await getRouteHandler('/buckets/:bucketId/objects', 'delete');
    const response = createResponse();

    await handler(
      createRequest({
        params: { bucketId: 'board-headshots' },
        body: { paths: ['members/headshot.jpg'] },
      }),
      response
    );

    expect(removeObjects).toHaveBeenCalledWith(['members/headshot.jpg']);
    expect(response.status).toHaveBeenCalledWith(200);
  });
});
