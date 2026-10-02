import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface SatelliteQueueStats {
  concurrency: number;
  active: number;
  pending: number;
  completed: number;
  failed: number;
}

export interface SatelliteJobQueue {
  enqueue(jobId: string, task: () => Promise<void>): Promise<void>;
  has(jobId: string): boolean;
  stats(): SatelliteQueueStats;
}

type QueueEntry = {
  jobId: string;
  task: () => Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
};

/** In-process bounded queue used by the local modular-monolith deployment. */
export class BoundedSatelliteJobQueue implements SatelliteJobQueue {
  private readonly pending: QueueEntry[] = [];
  private readonly active = new Set<string>();
  private readonly known = new Set<string>();
  private completed = 0;
  private failed = 0;

  constructor(readonly concurrency = Math.max(1, Math.min(16, Number(process.env.SATELLITE_JOB_CONCURRENCY ?? 2)))) {}

  enqueue(jobId: string, task: () => Promise<void>): Promise<void> {
    if (this.known.has(jobId)) return Promise.resolve();
    this.known.add(jobId);
    return new Promise<void>((resolve, reject) => {
      this.pending.push({ jobId, task, resolve, reject });
      this.pump();
    });
  }

  has(jobId: string): boolean { return this.known.has(jobId); }

  stats(): SatelliteQueueStats {
    return { concurrency: this.concurrency, active: this.active.size, pending: this.pending.length, completed: this.completed, failed: this.failed };
  }

  private pump(): void {
    while (this.active.size < this.concurrency && this.pending.length > 0) {
      const entry = this.pending.shift()!;
      this.active.add(entry.jobId);
      void entry.task().then(
        () => {
          this.completed += 1;
          this.finish(entry);
          // Resolve only after the entry has left the active set and the next
          // queued task has been scheduled. Consumers can therefore trust
          // stats() immediately after awaiting enqueue().
          entry.resolve();
        },
        (error) => {
          this.failed += 1;
          this.finish(entry);
          entry.reject(error);
        }
      );
    }
  }

  private finish(entry: QueueEntry): void {
    this.active.delete(entry.jobId);
    this.known.delete(entry.jobId);
    this.pump();
  }
}

export interface SatelliteAuditEvent {
  event_id: string;
  at: string;
  action: string;
  job_id?: string;
  metadata_id?: string;
  actor: string;
  correlation_id?: string;
  details?: Record<string, unknown>;
}

type AuditFile = { version: 1; events: SatelliteAuditEvent[] };

function atomicWrite(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(temporary, filePath);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}

export class SatelliteAuditStore {
  private readonly events: SatelliteAuditEvent[] = [];

  constructor(readonly filePath: string, private readonly maxEvents = 10_000) {
    if (!fs.existsSync(filePath)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<AuditFile>;
      this.events.push(...(parsed.events ?? []).filter((event) => event && typeof event.event_id === 'string').slice(-maxEvents));
    } catch {
      // Audit persistence is operational telemetry and must not prevent startup.
    }
  }

  record(input: Omit<SatelliteAuditEvent, 'event_id' | 'at'> & Partial<Pick<SatelliteAuditEvent, 'event_id' | 'at'>>): SatelliteAuditEvent {
    const event: SatelliteAuditEvent = {
      ...input,
      event_id: input.event_id ?? crypto.randomUUID(),
      at: input.at ?? new Date().toISOString(),
    };
    this.events.push(event);
    if (this.events.length > this.maxEvents) this.events.splice(0, this.events.length - this.maxEvents);
    atomicWrite(this.filePath, { version: 1, events: this.events } satisfies AuditFile);
    return event;
  }

  list(options: { jobId?: string; action?: string; limit?: number } = {}): SatelliteAuditEvent[] {
    const limit = Math.max(1, Math.min(1000, Math.trunc(options.limit ?? 100)));
    return this.events
      .filter((event) => (!options.jobId || event.job_id === options.jobId) && (!options.action || event.action === options.action))
      .slice()
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, limit);
  }
}
