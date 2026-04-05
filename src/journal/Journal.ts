// Journal — append-only diagnostic log with five entry types
// Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 17.1–17.8

import type {
    EngineLogEntry,
    StateTransitionLogEntry,
    RiskRejectionLogEntry,
    MicroEventLogEntry,
    SystemDiagnosticLogEntry,
    VolatilityRegime,
    StressState,
    SystemState,
} from '../../shared/types/index.js';

export type JournalEntry =
    | EngineLogEntry
    | StateTransitionLogEntry
    | RiskRejectionLogEntry
    | MicroEventLogEntry
    | SystemDiagnosticLogEntry;

export interface JournalBackend {
    write(entry: JournalEntry): Promise<void>;
    query(params: JournalQueryParams): Promise<JournalEntry[]>;
    close(): Promise<void>;
}

export interface JournalQueryParams {
    engine?: string;
    from?: string;   // UTC ISO 8601
    to?: string;     // UTC ISO 8601
    page?: number;
    pageSize?: number;
}

export interface JournalQueryResult {
    entries: JournalEntry[];
    total: number;
    page: number;
    pageSize: number;
}

// ── Write queue ──────────────────────────────────────────────────────────────

const MAX_QUEUE_DEPTH = 1000;

export class Journal {
    private readonly backends: JournalBackend[];
    private readonly queue: JournalEntry[] = [];
    private processing = false;
    private droppedCount = 0;

    constructor(backends: JournalBackend[]) {
        this.backends = backends;
    }

    // ── Writers (fire-and-forget, never block pipeline) ──────────────────────

    writeEngine(entry: Omit<EngineLogEntry, 'type'>): void {
        this.enqueue({ type: 'ENGINE', ...entry });
    }

    writeStateTransition(entry: Omit<StateTransitionLogEntry, 'type'>): void {
        this.enqueue({ type: 'STATE_TRANSITION', ...entry });
    }

    writeRiskRejection(entry: Omit<RiskRejectionLogEntry, 'type'>): void {
        this.enqueue({ type: 'RISK_REJECTION', ...entry });
    }

    writeMicroEvent(entry: Omit<MicroEventLogEntry, 'type'>): void {
        this.enqueue({ type: 'MICRO_EVENT', ...entry });
    }

    writeDiagnostic(entry: Omit<SystemDiagnosticLogEntry, 'type'>): void {
        this.enqueue({ type: 'SYSTEM_DIAGNOSTIC', ...entry });
    }

    // ── Query ────────────────────────────────────────────────────────────────

    async query(params: JournalQueryParams): Promise<JournalQueryResult> {
        // Use first backend that supports query (prefer non-ring-buffer for persistence)
        const backend = this.backends[0];
        if (!backend) return { entries: [], total: 0, page: 1, pageSize: 50 };

        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 50;

        const all = await backend.query(params);

        const total = all.length;
        const start = (page - 1) * pageSize;
        const entries = all.slice(start, start + pageSize);

        return { entries, total, page, pageSize };
    }

    // ── Internal queue management ────────────────────────────────────────────

    private enqueue(entry: JournalEntry): void {
        if (this.queue.length >= MAX_QUEUE_DEPTH) {
            // Drop oldest entry, log single warning
            this.queue.shift();
            this.droppedCount++;
            if (this.droppedCount === 1 || this.droppedCount % 100 === 0) {
                console.warn(`[Journal] Write queue overflow — dropped ${this.droppedCount} entries`);
            }
        }
        this.queue.push(entry);
        this.processQueue();
    }

    private processQueue(): void {
        if (this.processing) return;
        this.processing = true;
        // Async, non-blocking
        setImmediate(() => this.flush());
    }

    private async flush(): Promise<void> {
        while (this.queue.length > 0) {
            const entry = this.queue.shift()!;
            for (const backend of this.backends) {
                try {
                    await backend.write(entry);
                } catch (err) {
                    // Log to fallback error sink, never interrupt pipeline
                    console.error('[Journal] Write failure:', err instanceof Error ? err.message : err);
                }
            }
        }
        this.processing = false;
    }

    async close(): Promise<void> {
        // Flush remaining entries before closing
        await this.flush();
        for (const backend of this.backends) {
            await backend.close();
        }
    }
}

// ── Convenience factory helpers ──────────────────────────────────────────────

export function makeEngineEntry(
    engineName: string,
    engineVersion: string,
    bundleSeq: number,
    input: unknown,
    output: unknown,
    intermediateValues: Record<string, unknown>,
    durationMs: number,
    error?: import('../../shared/types/index.js').EngineError,
): Omit<EngineLogEntry, 'type'> {
    return {
        timestamp: new Date().toISOString(),
        engineName,
        engineVersion,
        bundleSeq,
        input,
        output,
        intermediateValues,
        durationMs,
        ...(error ? { error } : {}),
    };
}

export function makeStateTransitionEntry(
    fromState: SystemState | null,
    toState: SystemState,
    reason: string,
    alignmentScore: number,
    bundleSeq: number,
): Omit<StateTransitionLogEntry, 'type'> {
    return {
        timestamp: new Date().toISOString(),
        fromState,
        toState,
        reason,
        alignmentScore,
        bundleSeq,
    };
}

export function makeRiskRejectionEntry(
    rejectReasons: string[],
    probability: number,
    volatilityRegime: VolatilityRegime,
    globalStress: StressState,
    bundleSeq: number,
): Omit<RiskRejectionLogEntry, 'type'> {
    return {
        timestamp: new Date().toISOString(),
        rejectReasons,
        probability,
        volatilityRegime,
        globalStress,
        bundleSeq,
    };
}
