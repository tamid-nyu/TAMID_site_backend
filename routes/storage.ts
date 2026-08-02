import { Buffer } from 'node:buffer';
import express, { type Request, type Response } from 'express';
import { describeSupabaseError, getSupabaseAdmin } from '../config/supabase.js';
import { asyncHandler, requireAdminUser, validateInput } from '../middleware/index.js';

const router = express.Router();

router.use(validateInput);
router.use(requireAdminUser);

interface StorageBucket {
  id: string;
  name: string;
  public?: boolean;
  [key: string]: unknown;
}

interface StorageListEntry {
  name: string;
  id?: string | null;
  metadata?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
  last_accessed_at?: string | null;
}

interface StorageResult<T> {
  data: T | null;
  error: unknown;
}

interface StorageListOptions {
  limit: number;
  offset: number;
  sortBy: {
    column: 'name' | 'updated_at' | 'created_at' | 'last_accessed_at';
    order: 'asc' | 'desc';
  };
  search?: string;
}

interface StorageFileApi {
  list(path?: string, options?: StorageListOptions): Promise<StorageResult<StorageListEntry[]>>;
  upload(
    path: string,
    fileBody: Buffer,
    options: {
      cacheControl?: string;
      contentType?: string;
      upsert?: boolean;
    }
  ): Promise<StorageResult<unknown>>;
  update(
    path: string,
    fileBody: Buffer,
    options: {
      cacheControl?: string;
      contentType?: string;
    }
  ): Promise<StorageResult<unknown>>;
  move(fromPath: string, toPath: string): Promise<StorageResult<unknown>>;
  remove(paths: string[]): Promise<StorageResult<unknown>>;
  getPublicUrl(path: string): { data: { publicUrl: string } };
}

interface StorageUploadBody {
  path?: unknown;
  contentBase64?: unknown;
  contentType?: unknown;
  cacheControl?: unknown;
  upsert?: unknown;
}

interface StorageUpdateBody extends StorageUploadBody {
  newPath?: unknown;
  recursive?: unknown;
}

interface StorageDeleteBody {
  path?: unknown;
  paths?: unknown;
  recursive?: unknown;
}

interface ApiStorageObject {
  name: string;
  path: string;
  type: 'file' | 'folder';
  metadata: unknown;
  publicUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  lastAccessedAt?: string;
}

const STORAGE_PATH_PATTERN = /^[^/](?:.*[^/])?$/;

const parseIntegerQuery = (
  value: unknown,
  defaultValue: number,
  min: number,
  max: number
): number => {
  if (typeof value !== 'string' || value.trim() === '') {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min) {
    return defaultValue;
  }

  return Math.min(parsed, max);
};

const parseBoolean = (value: unknown): boolean => {
  return value === true || value === 'true' || value === '1';
};

const sendValidationError = (res: Response, message: string): void => {
  res.status(400).json({
    success: false,
    error: {
      message,
      code: 'VALIDATION_ERROR',
    },
  });
};

const VERSIONED_IMAGE_WORKFLOWS: Record<string, string> = {
  'event-flyers': 'PUT /v1/events/:id/flyer',
  'board-headshots': 'PUT /v1/board-members/:id/headshot',
};

const sendVersionedImageWorkflowRequired = (
  res: Response,
  bucketId: string,
  workflowPath: string
): void => {
  res.status(400).json({
    success: false,
    error: {
      message: `Replace objects in ${bucketId} through ${workflowPath}`,
      code: 'VERSIONED_IMAGE_WORKFLOW_REQUIRED',
    },
  });
};

const normalizeStoragePath = (value: unknown, label = 'path'): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const path = value.trim();
  if (
    !path ||
    !STORAGE_PATH_PATTERN.test(path) ||
    path.includes('//') ||
    path.split('/').some((part) => part === '.' || part === '..' || part === '')
  ) {
    throw new Error(
      `${label} must be a relative object path without empty, dot, or parent segments`
    );
  }

  return path;
};

const normalizePrefix = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    return '';
  }

  const prefix = value.trim().replace(/\/+$/, '');
  if (!prefix) {
    return '';
  }

  const normalized = normalizeStoragePath(prefix, 'prefix');
  if (normalized === null) {
    throw new Error('prefix must be a relative storage path');
  }

  return normalized;
};

const getBucketClient = (bucketId: string): StorageFileApi => {
  return getSupabaseAdmin().storage.from(bucketId) as unknown as StorageFileApi;
};

const joinStoragePath = (prefix: string, name: string): string => {
  return prefix ? `${prefix}/${name}` : name;
};

const isFolderEntry = (entry: StorageListEntry): boolean => {
  return entry.id == null && entry.metadata == null;
};

const toApiStorageObject = (
  bucket: StorageFileApi,
  prefix: string,
  entry: StorageListEntry
): ApiStorageObject => {
  const path = joinStoragePath(prefix, entry.name);
  const type = isFolderEntry(entry) ? 'folder' : 'file';
  const apiObject: ApiStorageObject = {
    name: entry.name,
    path,
    type,
    metadata: entry.metadata ?? null,
  };

  if (entry.created_at) {
    apiObject.createdAt = entry.created_at;
  }
  if (entry.updated_at) {
    apiObject.updatedAt = entry.updated_at;
  }
  if (entry.last_accessed_at) {
    apiObject.lastAccessedAt = entry.last_accessed_at;
  }
  if (type === 'file') {
    apiObject.publicUrl = bucket.getPublicUrl(path).data.publicUrl;
  }

  return apiObject;
};

const getListOptions = (req: Request): StorageListOptions => {
  const sortColumn = req.query.sortBy === 'updated_at' ? 'updated_at' : 'name';
  const order = req.query.order === 'desc' ? 'desc' : 'asc';
  const options: StorageListOptions = {
    limit: parseIntegerQuery(req.query.limit, 100, 1, 1000),
    offset: parseIntegerQuery(req.query.offset, 0, 0, 100000),
    sortBy: { column: sortColumn, order },
  };

  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    options.search = req.query.search.trim();
  }

  return options;
};

const decodeBase64Body = (contentBase64: unknown): Buffer | null => {
  if (typeof contentBase64 !== 'string' || !contentBase64.trim()) {
    return null;
  }

  return Buffer.from(contentBase64, 'base64');
};

const getContentOptions = (
  body: Pick<StorageUploadBody, 'cacheControl' | 'contentType'>
): { cacheControl?: string; contentType?: string } => {
  const options: { cacheControl?: string; contentType?: string } = {};
  if (typeof body.cacheControl === 'string' && body.cacheControl.trim()) {
    options.cacheControl = body.cacheControl.trim();
  }
  if (typeof body.contentType === 'string' && body.contentType.trim()) {
    options.contentType = body.contentType.trim();
  }
  return options;
};

const assertStorageSuccess = <T>(result: StorageResult<T>, action: string): T | null => {
  if (result.error) {
    throw new Error(`${action}: ${describeSupabaseError(result.error)}`);
  }

  return result.data;
};

const listObjects = async (
  bucket: StorageFileApi,
  prefix: string,
  options: StorageListOptions
): Promise<StorageListEntry[]> => {
  const result = await bucket.list(prefix, options);
  return assertStorageSuccess(result, 'Failed to list bucket objects') ?? [];
};

const listObjectPathsRecursively = async (
  bucket: StorageFileApi,
  prefix: string
): Promise<string[]> => {
  const entries = await listObjects(bucket, prefix, {
    limit: 1000,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  });
  const paths: string[] = [];

  for (const entry of entries) {
    const path = joinStoragePath(prefix, entry.name);
    if (isFolderEntry(entry)) {
      paths.push(...(await listObjectPathsRecursively(bucket, path)));
    } else {
      paths.push(path);
    }
  }

  return paths;
};

const movePrefixRecursively = async (
  bucket: StorageFileApi,
  oldPrefix: string,
  newPrefix: string
): Promise<Array<{ from: string; to: string }>> => {
  const sourcePaths = await listObjectPathsRecursively(bucket, oldPrefix);
  const moves = sourcePaths.map((from) => ({
    from,
    to: `${newPrefix}/${from.slice(oldPrefix.length).replace(/^\/+/, '')}`,
  }));

  for (const move of moves) {
    assertStorageSuccess(await bucket.move(move.from, move.to), 'Failed to move bucket object');
  }

  return moves;
};

router.get(
  '/buckets',
  asyncHandler(async (_req: Request, res: Response) => {
    const result = (await getSupabaseAdmin().storage.listBuckets()) as StorageResult<
      StorageBucket[]
    >;
    const buckets = assertStorageSuccess(result, 'Failed to list storage buckets') ?? [];

    res.status(200).json({
      success: true,
      count: buckets.length,
      data: buckets,
    });
  })
);

router.get(
  '/buckets/:bucketId/objects',
  asyncHandler(async (req: Request, res: Response) => {
    const bucket = getBucketClient(req.params.bucketId as string);
    let prefix: string;

    try {
      prefix = normalizePrefix(req.query.prefix);
    } catch (error) {
      sendValidationError(res, error instanceof Error ? error.message : 'Invalid prefix');
      return;
    }

    const entries = await listObjects(bucket, prefix, getListOptions(req));
    const data = entries.map((entry) => toApiStorageObject(bucket, prefix, entry));

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  })
);

router.post(
  '/buckets/:bucketId/objects',
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as StorageUploadBody;
    let path: string | null;

    try {
      path = normalizeStoragePath(body.path);
    } catch (error) {
      sendValidationError(res, error instanceof Error ? error.message : 'Invalid storage path');
      return;
    }

    const fileBody = decodeBase64Body(body.contentBase64);
    if (!path || !fileBody) {
      sendValidationError(res, 'path and contentBase64 are required');
      return;
    }

    const replacementWorkflow = VERSIONED_IMAGE_WORKFLOWS[req.params.bucketId as string];
    if (replacementWorkflow && parseBoolean(body.upsert)) {
      sendVersionedImageWorkflowRequired(res, req.params.bucketId as string, replacementWorkflow);
      return;
    }

    const bucket = getBucketClient(req.params.bucketId as string);
    const result = await bucket.upload(path, fileBody, {
      ...getContentOptions(body),
      upsert: parseBoolean(body.upsert),
    });
    const data = assertStorageSuccess(result, 'Failed to upload bucket object');

    res.status(201).json({
      success: true,
      data: {
        path,
        result: data,
        publicUrl: bucket.getPublicUrl(path).data.publicUrl,
      },
    });
  })
);

router.put(
  '/buckets/:bucketId/objects',
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as StorageUpdateBody;
    let path: string | null;
    let newPath: string | null;

    try {
      path = normalizeStoragePath(body.path);
      newPath = normalizeStoragePath(body.newPath, 'newPath');
    } catch (error) {
      sendValidationError(res, error instanceof Error ? error.message : 'Invalid storage path');
      return;
    }

    if (!path) {
      sendValidationError(res, 'path is required');
      return;
    }

    const replacementWorkflow = VERSIONED_IMAGE_WORKFLOWS[req.params.bucketId as string];
    if (replacementWorkflow) {
      sendVersionedImageWorkflowRequired(res, req.params.bucketId as string, replacementWorkflow);
      return;
    }

    const fileBody = decodeBase64Body(body.contentBase64);
    if (!newPath && !fileBody) {
      sendValidationError(res, 'newPath or contentBase64 is required');
      return;
    }

    const bucket = getBucketClient(req.params.bucketId as string);
    const operations: Array<Record<string, unknown>> = [];
    let finalPath = path;

    if (newPath) {
      if (parseBoolean(body.recursive)) {
        const moves = await movePrefixRecursively(bucket, path, newPath);
        operations.push({ action: 'move-prefix', count: moves.length, moves });
      } else {
        assertStorageSuccess(await bucket.move(path, newPath), 'Failed to move bucket object');
        operations.push({ action: 'move', from: path, to: newPath });
      }
      finalPath = newPath;
    }

    if (fileBody) {
      const result = await bucket.update(finalPath, fileBody, getContentOptions(body));
      operations.push({
        action: 'replace',
        path: finalPath,
        result: assertStorageSuccess(result, 'Failed to update bucket object'),
      });
    }

    res.status(200).json({
      success: true,
      data: {
        path: finalPath,
        operations,
        publicUrl: bucket.getPublicUrl(finalPath).data.publicUrl,
      },
    });
  })
);

router.delete(
  '/buckets/:bucketId/objects',
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as StorageDeleteBody;
    const rawPaths = Array.isArray(body.paths) ? body.paths : [body.path];
    let paths: string[];

    try {
      paths = rawPaths
        .map((path) => normalizeStoragePath(path))
        .filter((path): path is string => path !== null);
    } catch (error) {
      sendValidationError(res, error instanceof Error ? error.message : 'Invalid storage path');
      return;
    }

    if (paths.length === 0) {
      sendValidationError(res, 'path or paths are required');
      return;
    }

    const bucket = getBucketClient(req.params.bucketId as string);
    const deletePaths = parseBoolean(body.recursive)
      ? (await Promise.all(paths.map((path) => listObjectPathsRecursively(bucket, path)))).flat()
      : paths;

    const result = await bucket.remove(deletePaths);
    const data = assertStorageSuccess(result, 'Failed to delete bucket objects');

    res.status(200).json({
      success: true,
      count: deletePaths.length,
      data: {
        paths: deletePaths,
        result: data,
      },
    });
  })
);

export default router;
