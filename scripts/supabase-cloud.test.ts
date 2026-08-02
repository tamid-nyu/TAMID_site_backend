import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildPlan,
  cleanStorageBucketDestination,
  getStorageUploadPath,
  parseArgs,
} from './supabase-cloud.js';
import type { ShellCommand, StorageUploadCommand } from './supabase-cloud.js';

const findShellCommand = (label: string, plan: ReturnType<typeof buildPlan>): ShellCommand => {
  const command = plan.commands.find(
    (plannedCommand): plannedCommand is ShellCommand =>
      plannedCommand.kind === 'shell' && plannedCommand.label === label
  );

  if (!command) {
    throw new Error(`Missing shell command: ${label}`);
  }

  return command;
};

const findStorageUploadCommand = (
  label: string,
  plan: ReturnType<typeof buildPlan>
): StorageUploadCommand => {
  const command = plan.commands.find(
    (plannedCommand): plannedCommand is StorageUploadCommand =>
      plannedCommand.kind === 'storage-upload' && plannedCommand.label === label
  );

  if (!command) {
    throw new Error(`Missing storage upload command: ${label}`);
  }

  return command;
};

describe('supabase cloud snapshot script', () => {
  it('defaults to a guarded download of both production storage buckets', () => {
    const options = parseArgs(['download']);

    expect(options.mode).toBe('download');
    expect(options.dryRun).toBe(false);
    expect(options.yes).toBe(false);
    expect(options.buckets).toEqual(['board-headshots', 'event-flyers']);
    expect(options.snapshotDir).toBe('supabase/.cloud-snapshot/latest');
  });

  it('accepts dry-run, yes, custom snapshot directory, and custom buckets', () => {
    const options = parseArgs([
      'apply-local',
      '--dry-run',
      '--yes',
      '--snapshot-dir',
      'tmp/snapshot',
      '--buckets',
      'one,two',
    ]);

    expect(options.mode).toBe('apply-local');
    expect(options.dryRun).toBe(true);
    expect(options.yes).toBe(true);
    expect(options.snapshotDir).toBe('tmp/snapshot');
    expect(options.buckets).toEqual(['one', 'two']);
    expect(options.localDatabaseUrl).toBe(
      'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
    );
  });

  it('downloads roles, public/storage schema, public rows, and bucket objects', () => {
    const plan = buildPlan(parseArgs(['download', '--dry-run', '--yes']));

    expect(plan.requiresConfirmation).toBe(true);
    expect(plan.commands.map((command) => command.label)).toEqual([
      'prepare snapshot directory',
      'dump roles',
      'dump public and storage schema',
      'dump public table rows',
      'clean board-headshots snapshot destination',
      'download board-headshots storage objects',
      'clean event-flyers snapshot destination',
      'download event-flyers storage objects',
      'write manifest',
    ]);
    const storageCommand = findShellCommand('download board-headshots storage objects', plan);
    expect(storageCommand.command).toBe('supabase');
    expect(storageCommand.args.slice(0, 3)).toEqual(['--experimental', 'storage', 'cp']);
    expect(storageCommand.args.at(-1)).toBe('supabase/.cloud-snapshot/latest/storage');
  });

  it('applies the downloaded rows and storage objects locally', () => {
    const plan = buildPlan(parseArgs(['apply-local', '--dry-run', '--yes']));

    expect(plan.requiresConfirmation).toBe(false);
    expect(plan.commands.map((command) => command.label)).toEqual([
      'verify data dump exists',
      'import public table rows into local database',
      'upload board-headshots storage objects locally',
      'upload event-flyers storage objects locally',
    ]);
    const importCommand = findShellCommand('import public table rows into local database', plan);
    expect(importCommand.command).toBe('psql');
    expect(importCommand.args).toEqual([
      'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
      '--file',
      'supabase/.cloud-snapshot/latest/data.sql',
      '--set',
      'ON_ERROR_STOP=1',
    ]);
    const storageCommand = findStorageUploadCommand(
      'upload board-headshots storage objects locally',
      plan
    );
    expect(storageCommand.bucket).toBe('board-headshots');
    expect(storageCommand.sourceDir).toBe(
      'supabase/.cloud-snapshot/latest/storage/board-headshots'
    );
  });

  it('keeps exactly one bucket directory when a download is repeated', async () => {
    const snapshotDir = await mkdtemp(path.join(os.tmpdir(), 'tamid-cloud-snapshot-'));
    const storageDir = path.join(snapshotDir, 'storage');
    const bucket = 'event-flyers';

    const simulateCliDownload = async () => {
      await mkdir(path.join(storageDir, bucket), { recursive: true });
      await writeFile(path.join(storageDir, bucket, 'flyer.jpg'), 'image');
    };

    try {
      await mkdir(path.join(storageDir, bucket, bucket), { recursive: true });
      await writeFile(path.join(storageDir, bucket, bucket, 'stale.jpg'), 'stale');

      await cleanStorageBucketDestination(snapshotDir, bucket);
      await simulateCliDownload();
      await cleanStorageBucketDestination(snapshotDir, bucket);
      await simulateCliDownload();

      expect(await readdir(storageDir)).toEqual([bucket]);
      expect(await readdir(path.join(storageDir, bucket))).toEqual(['flyer.jpg']);
    } finally {
      await rm(snapshotDir, { recursive: true, force: true });
    }
  });

  it('rejects bucket names that could escape the storage snapshot root', () => {
    expect(() => parseArgs(['download', '--buckets', '../event-flyers'])).toThrow(
      'Invalid storage bucket name'
    );
  });

  it('uploads paths relative to bucket contents and rejects a duplicated bucket prefix', () => {
    const sourceDir = path.join('snapshot', 'storage', 'event-flyers');

    expect(
      getStorageUploadPath(sourceDir, path.join(sourceDir, 'thumbnails', 'id.jpg'), 'event-flyers')
    ).toBe('thumbnails/id.jpg');
    expect(() =>
      getStorageUploadPath(
        sourceDir,
        path.join(sourceDir, 'event-flyers', 'id.jpg'),
        'event-flyers'
      )
    ).toThrow('outside the event-flyers bucket contents');
  });
});
