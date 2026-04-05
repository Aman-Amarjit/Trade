// JSONL append-only filesystem backend with retention, compression, size enforcement
// Requirements: 17.1, 17.2, 17.3, 17.4, 17.6

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';
import type { JournalBackend, JournalEntry, JournalQueryParams } from '../Journal.js';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const MAX_SIZE_BYTES = 10 * 1024 * 1024 * 1024; // 10GB
const WARN_THRESHOLD = 0.9; // 90%
const COMPRESS_AFTER_MS = 60 * 60 * 1000; // 1 hour

export class FileBackend implements JournalBackend {
    private readonly logDir: string;
    private readonly retentionDays: number;
    private writeStream: fs.WriteStream | null = null;
    private currentFile: string = '';

    constructor(logDir: string, retentionDays = 7) {
        this.logDir = logDir;
        this.retentionDays = retentionDays;
        fs.mkdirSync(logDir, { recursive: true });
        this.rotateFile();
    }

    private rotateFile(): void {
        const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const filePath = path.join(this.logDir, `journal-${date}.jsonl`);
        if (filePath !== this.currentFile) {
            this.writeStream?.end();
            this.currentFile = filePath;
            this.writeStream = fs.createWriteStream(filePath, { flags: 'a' });
        }
    }

    async write(entry: JournalEntry): Promise<void> {
        this.rotateFile();
        await this.enforceSizeLimit();

        const line = JSON.stringify(entry) + '\n';
        return new Promise((resolve, reject) => {
            this.writeStream!.write(line, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async query(params: JournalQueryParams): Promise<JournalEntry[]> {
        const files = this.getQueryableFiles(params.from, params.to);
        const results: JournalEntry[] = [];

        for (const file of files) {
            const entries = await this.readFile(file);
            for (const entry of entries) {
                if (params.engine && entry.type === 'ENGINE') {
                    const e = entry as import('../../../shared/types/index.js').EngineLogEntry;
                    if (e.engineName !== params.engine) continue;
                }
                if (params.from && new Date(entry.timestamp).getTime() < new Date(params.from).getTime()) continue;
                if (params.to && new Date(entry.timestamp).getTime() > new Date(params.to).getTime()) continue;
                results.push(entry);
            }
        }

        return results;
    }

    private getQueryableFiles(from?: string, to?: string): string[] {
        if (!fs.existsSync(this.logDir)) return [];
        const files = fs.readdirSync(this.logDir)
            .filter(f => f.startsWith('journal-') && (f.endsWith('.jsonl') || f.endsWith('.jsonl.gz')))
            .map(f => path.join(this.logDir, f))
            .sort();

        if (!from && !to) return files;

        return files.filter(f => {
            const match = path.basename(f).match(/journal-(\d{4}-\d{2}-\d{2})/);
            if (!match) return true;
            const fileDate = new Date(match[1]).getTime();
            const fromTime = from ? new Date(from).getTime() - 86400000 : 0;
            const toTime = to ? new Date(to).getTime() + 86400000 : Infinity;
            return fileDate >= fromTime && fileDate <= toTime;
        });
    }

    private async readFile(filePath: string): Promise<JournalEntry[]> {
        try {
            let content: string;
            if (filePath.endsWith('.gz')) {
                const compressed = fs.readFileSync(filePath);
                const decompressed = await gunzip(compressed);
                content = decompressed.toString('utf-8');
            } else {
                content = fs.readFileSync(filePath, 'utf-8');
            }
            return content
                .split('\n')
                .filter(l => l.trim())
                .map(l => JSON.parse(l) as JournalEntry);
        } catch {
            return [];
        }
    }

    private async enforceSizeLimit(): Promise<void> {
        const totalSize = this.getTotalSize();
        const ratio = totalSize / MAX_SIZE_BYTES;

        if (ratio >= WARN_THRESHOLD) {
            console.warn(`[Journal] Storage at ${(ratio * 100).toFixed(1)}% capacity (${(totalSize / 1e9).toFixed(2)}GB / 10GB)`);
        }

        if (totalSize >= MAX_SIZE_BYTES) {
            await this.pruneOldest();
        }

        await this.compressOldFiles();
        await this.pruneExpiredFiles();
    }

    private getTotalSize(): number {
        if (!fs.existsSync(this.logDir)) return 0;
        return fs.readdirSync(this.logDir).reduce((sum, f) => {
            try {
                return sum + fs.statSync(path.join(this.logDir, f)).size;
            } catch {
                return sum;
            }
        }, 0);
    }

    private async pruneOldest(): Promise<void> {
        const files = fs.readdirSync(this.logDir)
            .filter(f => f.startsWith('journal-'))
            .map(f => ({ name: f, path: path.join(this.logDir, f), mtime: fs.statSync(path.join(this.logDir, f)).mtime }))
            .sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

        if (files.length > 0) {
            fs.unlinkSync(files[0].path);
            console.warn(`[Journal] Pruned oldest file: ${files[0].name}`);
        }
    }

    private async compressOldFiles(): Promise<void> {
        if (!fs.existsSync(this.logDir)) return;
        const now = Date.now();
        const files = fs.readdirSync(this.logDir)
            .filter(f => f.endsWith('.jsonl') && !f.endsWith('.gz'))
            .map(f => ({ name: f, path: path.join(this.logDir, f), mtime: fs.statSync(path.join(this.logDir, f)).mtime }));

        for (const file of files) {
            if (now - file.mtime.getTime() > COMPRESS_AFTER_MS && file.path !== this.currentFile) {
                try {
                    const content = fs.readFileSync(file.path);
                    const compressed = await gzip(content);
                    fs.writeFileSync(file.path + '.gz', compressed);
                    fs.unlinkSync(file.path);
                } catch (err) {
                    console.error('[Journal] Compression failed:', err);
                }
            }
        }
    }

    private async pruneExpiredFiles(): Promise<void> {
        if (!fs.existsSync(this.logDir)) return;
        const cutoff = Date.now() - this.retentionDays * 86400000;
        const files = fs.readdirSync(this.logDir)
            .filter(f => f.startsWith('journal-'))
            .map(f => ({ name: f, path: path.join(this.logDir, f), mtime: fs.statSync(path.join(this.logDir, f)).mtime }));

        for (const file of files) {
            if (file.mtime.getTime() < cutoff) {
                fs.unlinkSync(file.path);
            }
        }
    }

    async close(): Promise<void> {
        return new Promise((resolve) => {
            if (this.writeStream) {
                this.writeStream.end(resolve);
            } else {
                resolve();
            }
        });
    }
}
