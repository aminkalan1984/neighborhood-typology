import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export type SatelliteInfrastructureStatus = 'ready' | 'degraded' | 'unconfigured';

export interface SatelliteInfrastructureHealth {
  driver: string;
  status: SatelliteInfrastructureStatus;
  details: Record<string, string | number | boolean | null>;
}

export interface SatelliteStoredObject {
  uri: string;
  key: string;
  bytes: number;
  checksum_sha256: string;
}

export interface SatelliteObjectStorage {
  readonly driver: string;
  putFile(key: string, sourcePath: string, contentType: string): Promise<SatelliteStoredObject>;
  deletePrefix(prefix: string): Promise<{ deleted: number }>;
  health(): SatelliteInfrastructureHealth;
}

export interface SatelliteTileCacheMetrics {
  files: number;
  bytes: number;
}

export interface SatelliteTileCacheCleanupResult {
  removed: number;
  removed_bytes: number;
  remaining: SatelliteTileCacheMetrics;
}

export interface SatelliteTileCache {
  readonly driver: string;
  get(key: string): Promise<Buffer | null>;
  set(key: string, value: Buffer, ttlMs?: number): Promise<void>;
  metrics(): Promise<SatelliteTileCacheMetrics>;
  cleanup(options?: { ttlMs?: number; maxBytes?: number }): Promise<SatelliteTileCacheCleanupResult>;
  health(): SatelliteInfrastructureHealth;
  close?(): Promise<void>;
}

function normalizeObjectKey(value: string): string {
  const normalized = path.posix.normalize(value.replaceAll('\\', '/')).replace(/^\/+/, '');
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error('Object storage key is unsafe');
  }
  return normalized;
}

function sha256File(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function fileSizeRecursive(root: string): number {
  if (!fs.existsSync(root)) return 0;
  let bytes = 0;
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else bytes += fs.statSync(target).size;
    }
  }
  return bytes;
}

export class FileSystemSatelliteObjectStorage implements SatelliteObjectStorage {
  readonly driver = 'filesystem';

  constructor(readonly root: string) {
    fs.mkdirSync(root, { recursive: true });
  }

  async putFile(key: string, sourcePath: string): Promise<SatelliteStoredObject> {
    const normalizedKey = normalizeObjectKey(key);
    const absoluteSource = path.resolve(sourcePath);
    const absoluteRoot = path.resolve(this.root);
    const destination = path.resolve(absoluteRoot, normalizedKey);
    if (destination !== absoluteRoot && !destination.startsWith(`${absoluteRoot}${path.sep}`)) throw new Error('Object storage destination is outside the configured root');
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (absoluteSource !== destination) fs.copyFileSync(absoluteSource, destination);
    const stat = fs.statSync(destination);
    return { uri: pathToFileURL(destination).href, key: normalizedKey, bytes: stat.size, checksum_sha256: sha256File(destination) };
  }

  async deletePrefix(prefix: string): Promise<{ deleted: number }> {
    const normalized = normalizeObjectKey(prefix);
    const absoluteRoot = path.resolve(this.root);
    const target = path.resolve(absoluteRoot, normalized);
    if (target === absoluteRoot || !target.startsWith(`${absoluteRoot}${path.sep}`) || !fs.existsSync(target)) return { deleted: 0 };
    let deleted = 0;
    const stack = [target];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (entry.isDirectory()) stack.push(path.join(current, entry.name));
        else deleted += 1;
      }
    }
    fs.rmSync(target, { recursive: true, force: true });
    return { deleted };
  }

  health(): SatelliteInfrastructureHealth {
    return { driver: this.driver, status: 'ready', details: { root: path.resolve(this.root), bytes: fileSizeRecursive(this.root) } };
  }
}

type AwsSdkModule = {
  S3Client: new (options: Record<string, unknown>) => { send(command: unknown): Promise<Record<string, unknown>> };
  PutObjectCommand: new (input: Record<string, unknown>) => unknown;
  ListObjectsV2Command: new (input: Record<string, unknown>) => unknown;
  DeleteObjectsCommand: new (input: Record<string, unknown>) => unknown;
};

/** Optional S3-compatible adapter. The AWS SDK is loaded only when this driver is selected. */
export class S3CompatibleSatelliteObjectStorage implements SatelliteObjectStorage {
  readonly driver = 's3';
  private clientPromise: Promise<{ sdk: AwsSdkModule; client: { send(command: unknown): Promise<Record<string, unknown>> } }> | null = null;

  constructor(
    readonly bucket: string,
    readonly prefix = 'satellite',
    readonly endpoint = process.env.SATELLITE_S3_ENDPOINT,
    readonly region = process.env.SATELLITE_S3_REGION || 'us-east-1',
  ) {}

  private async client() {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const moduleName = '@aws-sdk/client-s3';
        const sdk = await import(moduleName) as unknown as AwsSdkModule;
        const options: Record<string, unknown> = { region: this.region };
        if (this.endpoint) {
          options.endpoint = this.endpoint;
          options.forcePathStyle = process.env.SATELLITE_S3_FORCE_PATH_STYLE !== 'false';
        }
        const accessKeyId = process.env.SATELLITE_S3_ACCESS_KEY_ID;
        const secretAccessKey = process.env.SATELLITE_S3_SECRET_ACCESS_KEY;
        if (accessKeyId && secretAccessKey) options.credentials = { accessKeyId, secretAccessKey, sessionToken: process.env.SATELLITE_S3_SESSION_TOKEN };
        return { sdk, client: new sdk.S3Client(options) };
      })();
    }
    return this.clientPromise;
  }

  private objectKey(key: string): string {
    return normalizeObjectKey(`${this.prefix}/${normalizeObjectKey(key)}`);
  }

  async putFile(key: string, sourcePath: string, contentType: string): Promise<SatelliteStoredObject> {
    if (!this.bucket) throw new Error('SATELLITE_S3_BUCKET is required for S3 object storage');
    const { sdk, client } = await this.client();
    const objectKey = this.objectKey(key);
    const stat = fs.statSync(sourcePath);
    const checksum = sha256File(sourcePath);
    await client.send(new sdk.PutObjectCommand({ Bucket: this.bucket, Key: objectKey, Body: fs.createReadStream(sourcePath), ContentType: contentType, Metadata: { sha256: checksum } }));
    return { uri: `s3://${this.bucket}/${objectKey}`, key: objectKey, bytes: stat.size, checksum_sha256: checksum };
  }

  async deletePrefix(prefix: string): Promise<{ deleted: number }> {
    if (!this.bucket) return { deleted: 0 };
    const { sdk, client } = await this.client();
    const objectPrefix = this.objectKey(prefix).replace(/\/$/, '');
    let continuationToken: string | undefined;
    let deleted = 0;
    do {
      const page = await client.send(new sdk.ListObjectsV2Command({ Bucket: this.bucket, Prefix: objectPrefix, ContinuationToken: continuationToken }));
      const contents = Array.isArray(page.Contents) ? page.Contents as Array<{ Key?: string }> : [];
      const objects = contents.flatMap((item) => item.Key ? [{ Key: item.Key }] : []);
      if (objects.length > 0) {
        await client.send(new sdk.DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: objects, Quiet: true } }));
        deleted += objects.length;
      }
      continuationToken = typeof page.NextContinuationToken === 'string' ? page.NextContinuationToken : undefined;
    } while (continuationToken);
    return { deleted };
  }

  health(): SatelliteInfrastructureHealth {
    const configured = Boolean(this.bucket);
    return { driver: this.driver, status: configured ? 'ready' : 'unconfigured', details: { bucket: this.bucket || null, prefix: this.prefix, endpoint: this.endpoint || null, region: this.region, sdk_lazy_loaded: true } };
  }
}

function cacheFilePath(root: string, key: string): string {
  const digest = crypto.createHash('sha256').update(key).digest('hex');
  return path.join(root, digest.slice(0, 2), digest.slice(2, 4), `${digest}.png`);
}

export class FileSystemSatelliteTileCache implements SatelliteTileCache {
  readonly driver = 'filesystem';

  constructor(readonly root: string) {
    fs.mkdirSync(root, { recursive: true });
  }

  async get(key: string): Promise<Buffer | null> {
    const target = cacheFilePath(this.root, key);
    if (!fs.existsSync(target)) return null;
    const now = new Date();
    fs.utimesSync(target, now, now);
    return fs.readFileSync(target);
  }

  async set(key: string, value: Buffer): Promise<void> {
    const target = cacheFilePath(this.root, key);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temporary = `${target}.tmp-${process.pid}-${crypto.randomUUID()}`;
    try {
      fs.writeFileSync(temporary, value);
      fs.renameSync(temporary, target);
    } finally {
      if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
    }
  }

  async metrics(): Promise<SatelliteTileCacheMetrics> {
    let files = 0;
    let bytes = 0;
    if (!fs.existsSync(this.root)) return { files, bytes };
    const stack = [this.root];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const target = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(target);
        else if (entry.name.endsWith('.png')) { const stat = fs.statSync(target); files += 1; bytes += stat.size; }
      }
    }
    return { files, bytes };
  }

  async cleanup(options: { ttlMs?: number; maxBytes?: number } = {}): Promise<SatelliteTileCacheCleanupResult> {
    const ttlMs = Math.max(60_000, options.ttlMs ?? Number(process.env.SATELLITE_TILE_CACHE_TTL_MS ?? 86_400_000));
    const maxBytes = Math.max(10 * 1024 * 1024, options.maxBytes ?? Number(process.env.SATELLITE_TILE_CACHE_MAX_BYTES ?? 2 * 1024 * 1024 * 1024));
    const candidates: Array<{ path: string; size: number; mtime: number }> = [];
    if (fs.existsSync(this.root)) {
      const stack = [this.root];
      while (stack.length > 0) {
        const current = stack.pop()!;
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
          const target = path.join(current, entry.name);
          if (entry.isDirectory()) stack.push(target);
          else if (entry.name.endsWith('.png')) { const stat = fs.statSync(target); candidates.push({ path: target, size: stat.size, mtime: stat.mtimeMs }); }
        }
      }
    }
    let total = candidates.reduce((sum, item) => sum + item.size, 0);
    let removed = 0;
    let removedBytes = 0;
    const now = Date.now();
    for (const item of candidates.sort((a, b) => a.mtime - b.mtime)) {
      if (now - item.mtime <= ttlMs && total <= maxBytes) continue;
      fs.rmSync(item.path, { force: true });
      removed += 1;
      removedBytes += item.size;
      total -= item.size;
    }
    return { removed, removed_bytes: removedBytes, remaining: await this.metrics() };
  }

  health(): SatelliteInfrastructureHealth {
    return { driver: this.driver, status: 'ready', details: { root: path.resolve(this.root), ttl_ms: Number(process.env.SATELLITE_TILE_CACHE_TTL_MS ?? 86_400_000), max_bytes: Number(process.env.SATELLITE_TILE_CACHE_MAX_BYTES ?? 2 * 1024 * 1024 * 1024) } };
  }
}

type RedisClient = {
  connect(): Promise<void>;
  isOpen: boolean;
  sendCommand(command: string[], options?: Record<string, unknown>): Promise<unknown>;
  scanIterator(options: Record<string, unknown>): AsyncIterable<string>;
  quit(): Promise<void>;
};

/** Optional Redis adapter. The redis package and connection are loaded lazily. */
export class RedisSatelliteTileCache implements SatelliteTileCache {
  readonly driver = 'redis';
  private clientPromise: Promise<RedisClient> | null = null;

  constructor(readonly url: string, readonly namespace = 'ara:satellite:tile') {}

  private async client(): Promise<RedisClient> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const moduleName = 'redis';
        const redis = await import(moduleName) as unknown as { createClient(options: Record<string, unknown>): RedisClient };
        const client = redis.createClient({ url: this.url });
        if (!client.isOpen) await client.connect();
        return client;
      })();
    }
    return this.clientPromise;
  }

  private key(value: string): string {
    return `${this.namespace}:${crypto.createHash('sha256').update(value).digest('hex')}`;
  }

  async get(key: string): Promise<Buffer | null> {
    const result = await (await this.client()).sendCommand(['GET', this.key(key)]);
    if (result == null) return null;
    return Buffer.from(String(result), 'base64');
  }

  async set(key: string, value: Buffer, ttlMs = Number(process.env.SATELLITE_TILE_CACHE_TTL_MS ?? 86_400_000)): Promise<void> {
    await (await this.client()).sendCommand(['SET', this.key(key), value.toString('base64'), 'PX', String(Math.max(60_000, ttlMs))]);
  }

  async metrics(): Promise<SatelliteTileCacheMetrics> {
    const client = await this.client();
    let files = 0;
    let bytes = 0;
    for await (const key of client.scanIterator({ MATCH: `${this.namespace}:*`, COUNT: 200 })) {
      files += 1;
      bytes += Number(await client.sendCommand(['STRLEN', key]) ?? 0);
    }
    return { files, bytes };
  }

  async cleanup(): Promise<SatelliteTileCacheCleanupResult> {
    return { removed: 0, removed_bytes: 0, remaining: await this.metrics() };
  }

  health(): SatelliteInfrastructureHealth {
    return { driver: this.driver, status: this.url ? 'ready' : 'unconfigured', details: { url_configured: Boolean(this.url), namespace: this.namespace, connection_lazy: true } };
  }

  async close(): Promise<void> {
    if (!this.clientPromise) return;
    const client = await this.clientPromise;
    if (client.isOpen) await client.quit();
  }
}

export function createSatelliteObjectStorage(options: { workDir: string }): SatelliteObjectStorage {
  const driver = String(process.env.SATELLITE_OBJECT_STORAGE_DRIVER ?? 'filesystem').toLowerCase();
  if (driver === 's3') return new S3CompatibleSatelliteObjectStorage(process.env.SATELLITE_S3_BUCKET ?? '', process.env.SATELLITE_S3_PREFIX ?? 'satellite');
  return new FileSystemSatelliteObjectStorage(process.env.SATELLITE_OBJECT_STORAGE_ROOT ?? options.workDir);
}

export function createSatelliteTileCache(options: { root: string }): SatelliteTileCache {
  const driver = String(process.env.SATELLITE_TILE_CACHE_DRIVER ?? 'filesystem').toLowerCase();
  if (driver === 'redis') return new RedisSatelliteTileCache(process.env.SATELLITE_REDIS_URL ?? '', process.env.SATELLITE_REDIS_NAMESPACE ?? 'ara:satellite:tile');
  return new FileSystemSatelliteTileCache(process.env.SATELLITE_TILE_CACHE_ROOT ?? options.root);
}
