import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_BUCKETS = ['board-headshots', 'event-flyers'];
const DEFAULT_SNAPSHOT_DIR = 'supabase/.cloud-snapshot/latest';
const DEFAULT_LOCAL_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

type Mode = 'download' | 'apply-local';

export interface Options {
  mode: Mode;
  dryRun: boolean;
  yes: boolean;
  snapshotDir: string;
  buckets: string[];
  localDatabaseUrl: string;
}

export interface ShellCommand {
  kind: 'shell';
  label: string;
  command: string;
  args: string[];
}

export interface ManifestCommand {
  kind: 'manifest';
  label: string;
}

export interface AssertFileCommand {
  kind: 'assert-file';
  label: string;
  filePath: string;
}

export interface StorageUploadCommand {
  kind: 'storage-upload';
  label: string;
  bucket: string;
  sourceDir: string;
}

export interface CleanStorageBucketCommand {
  kind: 'clean-storage-bucket';
  label: string;
  bucket: string;
}

export type PlannedCommand =
  | ShellCommand
  | ManifestCommand
  | AssertFileCommand
  | CleanStorageBucketCommand
  | StorageUploadCommand;

export interface ExecutionPlan {
  mode: Mode;
  snapshotDir: string;
  buckets: string[];
  requiresConfirmation: boolean;
  commands: PlannedCommand[];
}

const usage = `Usage:
  npm run supabase:cloud:download -- [--yes] [--dry-run] [--snapshot-dir <path>] [--buckets a,b]
  npm run supabase:cloud:apply -- [--dry-run] [--snapshot-dir <path>] [--buckets a,b]

Environment:
  SUPABASE_CLOUD_SNAPSHOT_DIR  Override snapshot directory
  SUPABASE_DOWNLOAD_BUCKETS    Comma-separated bucket list
  SUPABASE_LOCAL_DATABASE_URL  Override local Postgres URL for psql imports`;

const parseList = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const STORAGE_BUCKET_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const assertValidBucket = (bucket: string): void => {
  if (!STORAGE_BUCKET_PATTERN.test(bucket)) {
    throw new Error(`Invalid storage bucket name: ${bucket}`);
  }
};

const requireValue = (args: string[], index: number, flag: string): string => {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value\n\n${usage}`);
  }
  return value;
};

export const parseArgs = (argv: string[], env: NodeJS.ProcessEnv = process.env): Options => {
  const [modeArg, ...flags] = argv;

  if (modeArg !== 'download' && modeArg !== 'apply-local') {
    throw new Error(`Mode must be "download" or "apply-local"\n\n${usage}`);
  }

  const options: Options = {
    mode: modeArg,
    dryRun: false,
    yes: false,
    snapshotDir: env.SUPABASE_CLOUD_SNAPSHOT_DIR || DEFAULT_SNAPSHOT_DIR,
    buckets: parseList(env.SUPABASE_DOWNLOAD_BUCKETS || DEFAULT_BUCKETS.join(',')),
    localDatabaseUrl: env.SUPABASE_LOCAL_DATABASE_URL || DEFAULT_LOCAL_DATABASE_URL,
  };

  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];

    if (flag === '--dry-run') {
      options.dryRun = true;
    } else if (flag === '--yes') {
      options.yes = true;
    } else if (flag === '--snapshot-dir') {
      options.snapshotDir = requireValue(flags, index, flag);
      index += 1;
    } else if (flag === '--buckets') {
      options.buckets = parseList(requireValue(flags, index, flag));
      index += 1;
    } else if (flag === '--help' || flag === '-h') {
      throw new Error(usage);
    } else {
      throw new Error(`Unknown flag: ${flag}\n\n${usage}`);
    }
  }

  if (options.buckets.length === 0) {
    throw new Error('At least one storage bucket is required');
  }
  options.buckets.forEach(assertValidBucket);

  return options;
};

const snapshotPath = (snapshotDir: string, ...parts: string[]): string =>
  path.join(snapshotDir, ...parts);

export const buildPlan = (options: Options): ExecutionPlan => {
  const roleDump = snapshotPath(options.snapshotDir, 'roles.sql');
  const schemaDump = snapshotPath(options.snapshotDir, 'schema.sql');
  const dataDump = snapshotPath(options.snapshotDir, 'data.sql');
  const storageDir = snapshotPath(options.snapshotDir, 'storage');

  if (options.mode === 'download') {
    return {
      mode: options.mode,
      snapshotDir: options.snapshotDir,
      buckets: options.buckets,
      requiresConfirmation: true,
      commands: [
        {
          kind: 'shell',
          label: 'prepare snapshot directory',
          command: 'mkdir',
          args: ['-p', storageDir],
        },
        {
          kind: 'shell',
          label: 'dump roles',
          command: 'supabase',
          args: ['db', 'dump', '--linked', '--role-only', '--file', roleDump],
        },
        {
          kind: 'shell',
          label: 'dump public and storage schema',
          command: 'supabase',
          args: ['db', 'dump', '--linked', '--schema', 'public,storage', '--file', schemaDump],
        },
        {
          kind: 'shell',
          label: 'dump public table rows',
          command: 'supabase',
          args: [
            'db',
            'dump',
            '--linked',
            '--data-only',
            '--use-copy',
            '--schema',
            'public',
            '--file',
            dataDump,
          ],
        },
        ...options.buckets.flatMap<PlannedCommand>((bucket) => [
          {
            kind: 'clean-storage-bucket',
            label: `clean ${bucket} snapshot destination`,
            bucket,
          },
          {
            kind: 'shell',
            label: `download ${bucket} storage objects`,
            command: 'supabase',
            args: [
              '--experimental',
              'storage',
              'cp',
              '--linked',
              '--recursive',
              `ss:///${bucket}`,
              storageDir,
            ],
          },
        ]),
        {
          kind: 'manifest',
          label: 'write manifest',
        },
      ],
    };
  }

  return {
    mode: options.mode,
    snapshotDir: options.snapshotDir,
    buckets: options.buckets,
    requiresConfirmation: false,
    commands: [
      {
        kind: 'assert-file',
        label: 'verify data dump exists',
        filePath: dataDump,
      },
      {
        kind: 'shell',
        label: 'import public table rows into local database',
        command: 'psql',
        args: [options.localDatabaseUrl, '--file', dataDump, '--set', 'ON_ERROR_STOP=1'],
      },
      ...options.buckets.map<StorageUploadCommand>((bucket) => ({
        kind: 'storage-upload',
        label: `upload ${bucket} storage objects locally`,
        bucket,
        sourceDir: snapshotPath(storageDir, bucket),
      })),
    ],
  };
};

const quoteArg = (value: string): string => {
  if (/^[A-Za-z0-9_./:=@%-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
};

const printableCommand = (command: ShellCommand): string =>
  [command.command, ...command.args].map(quoteArg).join(' ');

const toStoragePath = (filePath: string): string => filePath.split(path.sep).join('/');

export const getStorageUploadPath = (
  sourceDir: string,
  filePath: string,
  bucket: string
): string => {
  const relativePath = toStoragePath(path.relative(sourceDir, filePath));
  if (
    !relativePath ||
    relativePath === '..' ||
    relativePath.startsWith('../') ||
    relativePath.split('/')[0] === bucket
  ) {
    throw new Error(
      `Refusing to upload a path outside the ${bucket} bucket contents: ${relativePath}`
    );
  }
  return relativePath;
};

const listFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return listFiles(entryPath);
      }
      return [entryPath];
    })
  );

  return files.flat();
};

const runShellCommand = async (planned: ShellCommand): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(planned.command, planned.args, {
      stdio: 'inherit',
      shell: false,
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${planned.label} failed with exit code ${code ?? 'unknown'}`));
    });
  });
};

const assertFileExists = async (filePath: string): Promise<void> => {
  const fileStats = await stat(filePath);
  if (!fileStats.isFile()) {
    throw new Error(`${filePath} is not a file`);
  }
};

export const cleanStorageBucketDestination = async (
  snapshotDir: string,
  bucket: string
): Promise<void> => {
  assertValidBucket(bucket);
  const storageRoot = path.resolve(snapshotDir, 'storage');
  const bucketDestination = path.resolve(storageRoot, bucket);

  if (
    path.dirname(bucketDestination) !== storageRoot ||
    path.basename(bucketDestination) !== bucket
  ) {
    throw new Error(`Refusing to clean unsafe storage snapshot path: ${bucketDestination}`);
  }

  await rm(bucketDestination, { recursive: true, force: true });
};

const uploadStorageDirectory = async (command: StorageUploadCommand): Promise<void> => {
  const files = await listFiles(command.sourceDir);

  for (const filePath of files) {
    const relativePath = getStorageUploadPath(command.sourceDir, filePath, command.bucket);
    await runShellCommand({
      kind: 'shell',
      label: `${command.label}: ${relativePath}`,
      command: 'supabase',
      args: [
        '--experimental',
        'storage',
        'cp',
        '--local',
        filePath,
        `ss:///${command.bucket}/${relativePath}`,
      ],
    });
  }
};

const writeManifest = async (plan: ExecutionPlan): Promise<void> => {
  const manifest = {
    createdAt: new Date().toISOString(),
    mode: plan.mode,
    schemas: ['public', 'storage'],
    dataSchemas: ['public'],
    buckets: plan.buckets,
    excludes: ['auth.users', 'auth schema data', 'Supabase managed auth internals'],
    files: {
      roles: 'roles.sql',
      schema: 'schema.sql',
      data: 'data.sql',
      storage: 'storage/',
    },
  };

  await writeFile(
    snapshotPath(plan.snapshotDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
};

const confirmProductionDownload = async (options: Options): Promise<void> => {
  if (options.mode !== 'download' || options.yes || options.dryRun) {
    return;
  }

  if (!process.stdin.isTTY) {
    throw new Error('Refusing to download production rows without --yes in a noninteractive shell');
  }

  const rl = createInterface({ input, output });
  const answer = await rl.question(
    'This downloads production public table rows to a gitignored local snapshot. Type "download production data" to continue: '
  );
  rl.close();

  if (answer !== 'download production data') {
    throw new Error('Confirmation did not match; aborting');
  }
};

const executePlan = async (options: Options, plan: ExecutionPlan): Promise<void> => {
  await confirmProductionDownload(options);

  if (options.dryRun) {
    for (const command of plan.commands) {
      if (command.kind === 'shell') {
        console.log(`[dry-run] ${command.label}: ${printableCommand(command)}`);
      } else if (command.kind === 'assert-file') {
        console.log(`[dry-run] ${command.label}: ${command.filePath}`);
      } else if (command.kind === 'storage-upload') {
        console.log(`[dry-run] ${command.label}: ${command.sourceDir} -> ss:///${command.bucket}`);
      } else if (command.kind === 'clean-storage-bucket') {
        console.log(
          `[dry-run] ${command.label}: ${snapshotPath(plan.snapshotDir, 'storage', command.bucket)}`
        );
      } else {
        console.log(
          `[dry-run] ${command.label}: ${snapshotPath(plan.snapshotDir, 'manifest.json')}`
        );
      }
    }
    return;
  }

  await mkdir(plan.snapshotDir, { recursive: true });

  for (const command of plan.commands) {
    console.log(`==> ${command.label}`);
    if (command.kind === 'shell') {
      await runShellCommand(command);
    } else if (command.kind === 'assert-file') {
      await assertFileExists(command.filePath);
    } else if (command.kind === 'storage-upload') {
      await uploadStorageDirectory(command);
    } else if (command.kind === 'clean-storage-bucket') {
      await cleanStorageBucketDestination(plan.snapshotDir, command.bucket);
    } else {
      await writeManifest(plan);
    }
  }
};

const isDirectExecution = (): boolean => {
  const currentFile = fileURLToPath(import.meta.url);
  const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
  return currentFile === entryFile;
};

if (isDirectExecution()) {
  const options = parseArgs(process.argv.slice(2));
  const plan = buildPlan(options);

  executePlan(options, plan).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
