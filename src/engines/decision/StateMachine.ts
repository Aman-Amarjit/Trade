import type {
    Engine,
    EngineError,
    GeometryOutput,
    LiquidityMapOutput,
    MicrostructureOutput,
    PredictionOutput,
    RiskOutput,
    StateMachineOutput,
    StressState,
    SystemState,
    VolatilityRegime,
} from '../../../shared/types/index.js';

export interface StateMachineInput {
    microstructure: MicrostructureOutput;
    liquidityMap: LiquidityMapOutput;
    geometry: GeometryOutput;
    prediction: PredictionOutput;
    risk: RiskOutput;
    globalStress: StressState;
    volatilityRegime: VolatilityRegime;
    dataIntegrityOk: boolean;
    cooldownDurationMs?: number;
}

const DEFAULT_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

export class StateMachine implements Engine<StateMachineInput, StateMachineOutput> {
    readonly name = 'StateMachine';
    readonly version = '1.0.0';

    private currentState: SystemState = 'IDLE';
    private cooldownStartTime: number | null = null;
    private previousState: SystemState | null = null;

    execute(input: StateMachineInput): StateMachineOutput | EngineError {
        if (input == null) {
            return { type: 'VALIDATION', message: 'Input is null or undefined', recoverable: false };
        }

        const { microstructure, liquidityMap, geometry, risk,
            globalStress, dataIntegrityOk } = input;
        // Use a local variable to prevent TypeScript control-flow narrowing across branches
        const volatilityRegime: VolatilityRegime = input.volatilityRegime;
        const cooldownDurationMs = input.cooldownDurationMs ?? DEFAULT_COOLDOWN_MS;

        const stateBefore = this.currentState;
        let reason = `Remaining in ${this.currentState}`;

        // Safety overrides — checked FIRST
        const safetyTriggered =
            globalStress === 'HALT' ||
            (volatilityRegime as string) === 'EXTREME' ||
            !dataIntegrityOk ||
            risk.hardReject;

        if (safetyTriggered) {
            const reasons: string[] = [];
            if (globalStress === 'HALT') reasons.push('globalStress is HALT');
            if ((volatilityRegime as string) === 'EXTREME') reasons.push('volatilityRegime is EXTREME');
            if (!dataIntegrityOk) reasons.push('dataIntegrity check failed');
            if (risk.hardReject) reasons.push(`hardReject: ${risk.rejectReasons.join('; ')}`);
            reason = `Safety override → IDLE: ${reasons.join(', ')}`;

            if (this.currentState !== 'IDLE') {
                this.logTransition(stateBefore, 'IDLE', reason, microstructure.alignmentScore);
                this.previousState = stateBefore;
                this.currentState = 'IDLE';
                this.cooldownStartTime = null;
            }

            return this.buildOutput(microstructure.alignmentScore, reason, cooldownDurationMs);
        }

        // State transitions
        switch (this.currentState) {
            case 'IDLE': {
                const canWait =
                    (microstructure.bosDetected || microstructure.sweep) &&
                    geometry.isStable &&
                    liquidityMap.zones.length > 0 &&
                    !risk.hardReject;

                if (canWait) {
                    reason = 'BOS/sweep detected with stable geometry and liquidity zones';
                    this.transition('WAITING_FOR_RETEST', reason, microstructure.alignmentScore);
                }
                break;
            }

            case 'WAITING_FOR_RETEST': {
                const canTrade =
                    microstructure.retestZone &&
                    microstructure.alignmentScore >= 0.8 &&
                    geometry.isStable &&
                    liquidityMap.zones.length > 0 &&
                    !risk.hardReject &&
                    risk.probability >= 80 &&
                    globalStress === 'SAFE' &&
                    (volatilityRegime as string) !== 'EXTREME';

                if (canTrade) {
                    reason = 'Retest confirmed with high alignment and acceptable risk';
                    this.transition('IN_TRADE', reason, microstructure.alignmentScore);
                } else {
                    // Check if we should fall back to IDLE (safety conditions already handled above)
                    const shouldAbort =
                        !geometry.isStable ||
                        risk.hardReject ||
                        liquidityMap.zones.length === 0;

                    if (shouldAbort) {
                        reason = 'Conditions deteriorated while waiting for retest';
                        this.transition('IDLE', reason, microstructure.alignmentScore);
                    }
                }
                break;
            }

            case 'IN_TRADE': {
                const shouldCooldown =
                    !geometry.isStable ||
                    risk.hardReject ||
                    (volatilityRegime as string) === 'HIGH' ||
                    (volatilityRegime as string) === 'EXTREME' ||
                    microstructure.alignmentScore < 0.5;

                if (shouldCooldown) {
                    const reasons: string[] = [];
                    if (!geometry.isStable) reasons.push('geometry unstable');
                    if (risk.hardReject) reasons.push('hard reject triggered');
                    if ((volatilityRegime as string) === 'HIGH' || (volatilityRegime as string) === 'EXTREME') reasons.push(`volatility ${volatilityRegime}`);
                    if (microstructure.alignmentScore < 0.5) reasons.push('alignment score below 0.5');
                    reason = `Entering cooldown: ${reasons.join(', ')}`;
                    this.cooldownStartTime = Date.now();
                    this.transition('COOLDOWN', reason, microstructure.alignmentScore);
                }
                break;
            }

            case 'COOLDOWN': {
                const elapsed = this.cooldownStartTime != null ? Date.now() - this.cooldownStartTime : cooldownDurationMs;
                const expired = elapsed >= cooldownDurationMs;

                const canReturnToIdle =
                    expired &&
                    !microstructure.bosDetected &&
                    !microstructure.sweep &&
                    geometry.isStable &&
                    ((volatilityRegime as string) === 'LOW' || (volatilityRegime as string) === 'NORMAL');

                if (canReturnToIdle) {
                    reason = 'Cooldown expired with stable conditions';
                    this.cooldownStartTime = null;
                    this.transition('IDLE', reason, microstructure.alignmentScore);
                } else {
                    reason = 'Cooldown in progress';
                }
                break;
            }
        }

        return this.buildOutput(microstructure.alignmentScore, reason, cooldownDurationMs);
    }

    private transition(toState: SystemState, reason: string, alignmentScore: number): void {
        this.logTransition(this.currentState, toState, reason, alignmentScore);
        this.previousState = this.currentState;
        this.currentState = toState;
    }

    private logTransition(from: SystemState | null, to: SystemState, reason: string, alignmentScore: number): void {
        const entry = {
            type: 'STATE_TRANSITION',
            timestamp: new Date().toISOString(),
            fromState: from,
            toState: to,
            reason,
            alignmentScore,
            bundleSeq: -1,
        };
        console.log(JSON.stringify(entry));
    }

    private buildOutput(alignmentScore: number, reason: string, cooldownDurationMs: number): StateMachineOutput {
        let cooldownRemaining = 0;
        if (this.currentState === 'COOLDOWN' && this.cooldownStartTime != null) {
            const elapsed = Date.now() - this.cooldownStartTime;
            cooldownRemaining = Math.max(0, cooldownDurationMs - elapsed);
        }

        return {
            state: this.currentState,
            previousState: this.previousState,
            timestamp: new Date().toISOString(),
            reason,
            cooldownRemaining,
            alignmentScore,
        };
    }
}
