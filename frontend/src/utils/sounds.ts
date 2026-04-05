// Sound effects using Web Audio API — no external dependencies
// Each event has a distinct, immediately recognizable sound signature

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

function note(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    attack = 0.005,
): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
}

function sweep(
    ctx: AudioContext,
    freqStart: number,
    freqEnd: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    volume: number,
): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, startTime);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, startTime + duration);
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
}

// ── BOS Confirmed ─────────────────────────────────────────────────────────────
// Crisp ascending two-note chime — "structure broken, attention"
export function playBOS(): void {
    try {
        const ctx = getCtx();
        const t = ctx.currentTime;
        note(ctx, 523, t, 0.18, 'sine', 0.14); // C5
        note(ctx, 784, t + 0.14, 0.22, 'sine', 0.12); // G5
    } catch { /* audio blocked until user interaction */ }
}

// ── Sweep Detected ────────────────────────────────────────────────────────────
// Sharp downward glide — "liquidity taken"
export function playSweep(): void {
    try {
        const ctx = getCtx();
        const t = ctx.currentTime;
        sweep(ctx, 880, 330, t, 0.25, 'sine', 0.13);
        // subtle click at start for sharpness
        note(ctx, 1200, t, 0.04, 'square', 0.05);
    } catch { /* ignore */ }
}

// ── Retest Zone Available ─────────────────────────────────────────────────────
// Soft triple ping — "opportunity forming"
export function playRetestZone(): void {
    try {
        const ctx = getCtx();
        const t = ctx.currentTime;
        note(ctx, 660, t, 0.14, 'sine', 0.10);
        note(ctx, 660, t + 0.16, 0.14, 'sine', 0.08);
        note(ctx, 880, t + 0.32, 0.20, 'sine', 0.10);
    } catch { /* ignore */ }
}

// ── Volatility Regime Change ──────────────────────────────────────────────────
// LOW/NORMAL: gentle ascending tone — "calming"
// HIGH: mid warning pulse — "caution"
// EXTREME: harsh descending alarm — "danger"
export function playRegimeChange(toExtreme: boolean): void {
    try {
        const ctx = getCtx();
        const t = ctx.currentTime;
        if (toExtreme) {
            // Harsh descending alarm
            sweep(ctx, 440, 110, t, 0.3, 'sawtooth', 0.14);
            sweep(ctx, 440, 110, t + 0.35, 0.3, 'sawtooth', 0.12);
        } else {
            // Gentle ascending notification
            note(ctx, 330, t, 0.15, 'triangle', 0.09);
            note(ctx, 440, t + 0.18, 0.20, 'triangle', 0.08);
        }
    } catch { /* ignore */ }
}

// ── Stress State Change ───────────────────────────────────────────────────────
// SAFE: soft resolution chord — "all clear"
// CAUTION: mid double-pulse — "watch out"
// HALT: low urgent alarm — "stop everything"
export function playStressChange(toHalt: boolean): void {
    try {
        const ctx = getCtx();
        const t = ctx.currentTime;
        if (toHalt) {
            // Low urgent alarm — three descending pulses
            note(ctx, 220, t, 0.25, 'sawtooth', 0.16);
            note(ctx, 185, t + 0.28, 0.25, 'sawtooth', 0.14);
            note(ctx, 155, t + 0.56, 0.35, 'sawtooth', 0.14);
        } else {
            // Soft resolution — ascending minor third
            note(ctx, 392, t, 0.18, 'sine', 0.09); // G4
            note(ctx, 494, t + 0.20, 0.22, 'sine', 0.08); // B4
        }
    } catch { /* ignore */ }
}

// ── Geometry Collapse Warning ─────────────────────────────────────────────────
// Three descending triangle pulses — "structure weakening"
export function playCollapseWarning(): void {
    try {
        const ctx = getCtx();
        const t = ctx.currentTime;
        note(ctx, 440, t, 0.18, 'triangle', 0.11);
        note(ctx, 330, t + 0.20, 0.18, 'triangle', 0.10);
        note(ctx, 220, t + 0.40, 0.25, 'triangle', 0.09);
    } catch { /* ignore */ }
}
