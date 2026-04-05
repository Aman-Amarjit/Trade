// In-memory ring buffer backend — for testing
// Requirements: 17.1

import type { JournalBackend, JournalEntry, JournalQueryParams } from '../Journal.js';

export class InMemoryBackend implements JournalBackend {
    private readonly entries: JournalEntry[] = [];
    private readonly maxSize: number;

    constructor(maxSize = 10_000) {
        this.maxSize = maxSize;
    }

    async write(entry: JournalEntry): Promise<void> {
        if (this.entries.length >= this.maxSize) {
            this.entries.shift(); // ring buffer — drop oldest
        }
        this.entries.push(entry);
    }

    async query(params: JournalQueryParams): Promise<JournalEntry[]> {
        let results = [...this.entries];

        if (params.engine) {
            results = results.filter(e =>
                e.type === 'ENGINE' && (e as import('../../../shared/types/index.js').EngineLogEntry).engineName === params.engine
            );
        }
        if (params.from) {
            const from = new Date(params.from).getTime();
            results = results.filter(e => new Date(e.timestamp).getTime() >= from);
        }
        if (params.to) {
            const to = new Date(params.to).getTime();
            results = results.filter(e => new Date(e.timestamp).getTime() <= to);
        }

        return results;
    }

    async close(): Promise<void> {
        // no-op for in-memory
    }

    get size(): number {
        return this.entries.length;
    }

    clear(): void {
        this.entries.length = 0;
    }
}
