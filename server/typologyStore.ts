import fs from 'node:fs/promises';
import path from 'node:path';
import type { TypologyRun, TypologyStore } from './typologyTypes';

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryTypologyStore implements TypologyStore {
  private readonly runs = new Map<string, TypologyRun>();

  async create(run: TypologyRun): Promise<void> {
    if (this.runs.has(run.run_id)) throw new Error(`Run ${run.run_id} already exists`);
    this.runs.set(run.run_id, clone(run));
  }

  async get(runId: string): Promise<TypologyRun | null> {
    const run = this.runs.get(runId);
    return run ? clone(run) : null;
  }

  async update(run: TypologyRun): Promise<void> {
    if (!this.runs.has(run.run_id)) throw new Error(`Run ${run.run_id} does not exist`);
    this.runs.set(run.run_id, clone(run));
  }

  async list(): Promise<TypologyRun[]> {
    return [...this.runs.values()].map(clone);
  }
}

export class FileTypologyStore implements TypologyStore {
  constructor(private readonly directory: string) {}

  private filePath(runId: string): string {
    if (!/^[0-9a-f-]{36}$/i.test(runId)) throw new Error('Invalid run id');
    return path.join(this.directory, `${runId}.json`);
  }

  private async ensureDirectory(): Promise<void> {
    await fs.mkdir(this.directory, { recursive: true });
  }

  async create(run: TypologyRun): Promise<void> {
    await this.ensureDirectory();
    const file = this.filePath(run.run_id);
    try {
      await fs.writeFile(file, `${JSON.stringify(run, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(`Run ${run.run_id} already exists`);
      throw error;
    }
  }

  async get(runId: string): Promise<TypologyRun | null> {
    try {
      return JSON.parse(await fs.readFile(this.filePath(runId), 'utf8')) as TypologyRun;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async update(run: TypologyRun): Promise<void> {
    await this.ensureDirectory();
    const file = this.filePath(run.run_id);
    const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(run, null, 2)}\n`, 'utf8');
    await fs.rename(temporary, file);
  }

  async list(): Promise<TypologyRun[]> {
    await this.ensureDirectory();
    const files = (await fs.readdir(this.directory)).filter((file) => /^[0-9a-f-]{36}\.json$/i.test(file));
    const runs = await Promise.all(files.map(async (file) => JSON.parse(await fs.readFile(path.join(this.directory, file), 'utf8')) as TypologyRun));
    return runs.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}

