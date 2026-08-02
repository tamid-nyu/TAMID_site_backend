import { Event } from '../models/index.js';
import type { EventRow } from '../types/index.js';
import { createVersionedImageReplacementHandler } from './versionedImageReplacement.js';

export const replaceEventFlyerHandler = createVersionedImageReplacementHandler({
  bucketId: 'event-flyers',
  table: 'events',
  fileColumn: 'flyer_file',
  versionColumn: 'updated_at',
  ownerResponseKey: 'event',
  imageResponseKey: 'flyer',
  ownerLabel: 'Event',
  imageLabel: 'event flyer',
  notFoundCode: 'EVENT_NOT_FOUND',
  serializeOwner: (row) => Event.toJSON(row as unknown as EventRow),
});
