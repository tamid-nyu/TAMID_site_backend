import { BoardMember } from '../models/index.js';
import type { BoardMemberRow } from '../types/index.js';
import { createVersionedImageReplacementHandler } from './versionedImageReplacement.js';

export const replaceBoardMemberHeadshotHandler = createVersionedImageReplacementHandler({
  bucketId: 'board-headshots',
  table: 'board_members',
  fileColumn: 'headshot_file',
  versionColumn: 'headshot_updated_at',
  ownerResponseKey: 'boardMember',
  imageResponseKey: 'headshot',
  ownerLabel: 'Board member',
  imageLabel: 'board member headshot',
  notFoundCode: 'BOARD_MEMBER_NOT_FOUND',
  serializeOwner: (row) => BoardMember.toJSON(row as unknown as BoardMemberRow),
});
