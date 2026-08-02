import { Buffer } from 'node:buffer';
import type { Request, Response } from 'express';
import { describeSupabaseError, getSupabaseAdmin } from '../config/supabase.js';

const VERSIONED_IMAGE_CACHE_SECONDS = '31536000';
const STORAGE_PATH_PATTERN = /^[^/](?:.*[^/])?$/;

interface ImageUploadInput {
  path?: unknown;
  contentBase64?: unknown;
  contentType?: unknown;
}

interface ReplaceImageBody {
  fullSize?: ImageUploadInput;
  thumbnail?: ImageUploadInput;
}

interface StorageResult<T> {
  data: T | null;
  error: unknown;
}

interface ImageBucket {
  upload(
    path: string,
    fileBody: Buffer,
    options: { cacheControl: string; contentType: string; upsert: boolean }
  ): Promise<StorageResult<unknown>>;
  getPublicUrl(path: string): { data: { publicUrl: string } };
}

interface ValidatedImageUpload {
  path: string;
  content: Buffer;
  contentType: string;
}

export interface VersionedImageReplacementConfig {
  bucketId: string;
  table: string;
  fileColumn: string;
  versionColumn: string;
  ownerResponseKey: string;
  imageResponseKey: string;
  ownerLabel: string;
  imageLabel: string;
  notFoundCode: string;
  serializeOwner: (row: Record<string, unknown>) => unknown;
}

const sendValidationError = (res: Response, message: string): void => {
  res.status(400).json({
    success: false,
    error: { message, code: 'VALIDATION_ERROR' },
  });
};

const validateUpload = (
  value: ImageUploadInput | undefined,
  label: 'fullSize' | 'thumbnail'
): ValidatedImageUpload | null => {
  if (!value || typeof value.path !== 'string') {
    return null;
  }

  const path = value.path.trim();
  if (
    !path ||
    !STORAGE_PATH_PATTERN.test(path) ||
    path.includes('//') ||
    path.split('/').some((part) => part === '.' || part === '..' || part === '')
  ) {
    throw new Error(`${label}.path must be a valid relative object path`);
  }

  if (typeof value.contentBase64 !== 'string' || value.contentBase64.trim() === '') {
    throw new Error(`${label}.contentBase64 is required`);
  }
  if (typeof value.contentType !== 'string' || !value.contentType.trim().startsWith('image/')) {
    throw new Error(`${label}.contentType must be an image media type`);
  }
  if (label === 'thumbnail' && value.contentType.trim() !== 'image/jpeg') {
    throw new Error('thumbnail.contentType must be image/jpeg');
  }

  const normalizedBase64 = value.contentBase64.trim();
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalizedBase64) || normalizedBase64.length % 4 !== 0) {
    throw new Error(`${label}.contentBase64 must be valid base64`);
  }

  const content = Buffer.from(normalizedBase64, 'base64');
  if (content.length === 0) {
    throw new Error(`${label}.contentBase64 must not decode to an empty file`);
  }

  return { path, content, contentType: value.contentType.trim() };
};

const assertStorageSuccess = (result: StorageResult<unknown>, label: string): void => {
  if (result.error) {
    throw new Error(`${label}: ${describeSupabaseError(result.error)}`);
  }
};

const versionPublicUrl = (publicUrl: string, version: string): string => {
  const url = new URL(publicUrl);
  url.searchParams.set('v', version);
  return url.toString();
};

export const getThumbnailPath = (ownerId: string): string => `thumbnails/${ownerId}.jpg`;

export const createVersionedImageReplacementHandler =
  (config: VersionedImageReplacementConfig) =>
  async (req: Request, res: Response): Promise<void> => {
    const body = (req.body ?? {}) as ReplaceImageBody;
    let fullSize: ValidatedImageUpload | null;
    let thumbnail: ValidatedImageUpload | null;

    try {
      fullSize = validateUpload(body.fullSize, 'fullSize');
      thumbnail = validateUpload(body.thumbnail, 'thumbnail');
    } catch (error) {
      sendValidationError(
        res,
        error instanceof Error ? error.message : `Invalid ${config.imageLabel} upload`
      );
      return;
    }

    if (!fullSize || !thumbnail) {
      sendValidationError(res, 'fullSize and thumbnail uploads are required');
      return;
    }
    const ownerId = req.params.id as string;
    if (fullSize.path.includes('/')) {
      sendValidationError(res, 'fullSize.path must be a root-level object path');
      return;
    }
    const extensionIndex = fullSize.path.lastIndexOf('.');
    const basename = extensionIndex > 0 ? fullSize.path.slice(0, extensionIndex) : '';
    if (basename !== ownerId || extensionIndex === fullSize.path.length - 1) {
      sendValidationError(res, `fullSize.path must be named ${ownerId}.{extension}`);
      return;
    }
    if (fullSize.path === thumbnail.path) {
      sendValidationError(res, 'fullSize.path and thumbnail.path must be different');
      return;
    }
    const expectedThumbnailPath = getThumbnailPath(ownerId);
    if (thumbnail.path !== expectedThumbnailPath) {
      sendValidationError(res, `thumbnail.path must be exactly ${expectedThumbnailPath}`);
      return;
    }

    const supabase = getSupabaseAdmin();
    const existing = await supabase.from(config.table).select('id').eq('id', ownerId).single();

    if (existing.error) {
      if (existing.error.code === 'PGRST116') {
        res.status(404).json({
          success: false,
          error: { message: `${config.ownerLabel} not found`, code: config.notFoundCode },
        });
        return;
      }
      throw new Error(
        `Failed to fetch ${config.ownerLabel.toLowerCase()}: ${describeSupabaseError(existing.error)}`
      );
    }

    const bucket = supabase.storage.from(config.bucketId) as unknown as ImageBucket;
    const uploadOptions = (contentType: string) => ({
      cacheControl: VERSIONED_IMAGE_CACHE_SECONDS,
      contentType,
      upsert: true,
    });

    assertStorageSuccess(
      await bucket.upload(fullSize.path, fullSize.content, uploadOptions(fullSize.contentType)),
      `Failed to upload full-size ${config.imageLabel}`
    );
    assertStorageSuccess(
      await bucket.upload(thumbnail.path, thumbnail.content, uploadOptions(thumbnail.contentType)),
      `Failed to upload ${config.imageLabel} thumbnail`
    );

    // The row version changes only after both cacheable objects are ready.
    const version = new Date().toISOString();
    const updated = await supabase
      .from(config.table)
      .update({ [config.fileColumn]: fullSize.path, [config.versionColumn]: version })
      .eq('id', ownerId)
      .select('*')
      .single();

    if (updated.error) {
      throw new Error(
        `Failed to update ${config.imageLabel}: ${describeSupabaseError(updated.error)}`
      );
    }

    const row = updated.data as Record<string, unknown>;
    const persistedVersion = row[config.versionColumn] as string;
    res.status(200).json({
      success: true,
      data: {
        [config.ownerResponseKey]: config.serializeOwner(row),
        [config.imageResponseKey]: {
          fullSizePath: fullSize.path,
          thumbnailPath: thumbnail.path,
          fullSizeUrl: versionPublicUrl(
            bucket.getPublicUrl(fullSize.path).data.publicUrl,
            persistedVersion
          ),
          thumbnailUrl: versionPublicUrl(
            bucket.getPublicUrl(thumbnail.path).data.publicUrl,
            persistedVersion
          ),
        },
      },
    });
  };
