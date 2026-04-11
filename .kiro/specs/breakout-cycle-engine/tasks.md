# Implementation Plan: BreakoutCycleEngine (Engine #15)

## Overview

Most of the scaffolding is already in place — the engine stub, shared types, pipeline wiring, scoring/risk extensions, frontend panel, and alert hooks all exist. The tasks below complete the remaining gaps, harden the logic against edge cases, and add the property-based and unit tests that validate correctness properties from the design document.

## Tasks

- [x] 1. Complete BreakoutCycleEngine core logic
  - [x] 1.1 Audit and fix range contraction detection
    - Verify the `insideRange` filter uses `c.low >= rl && c.high <= rh` (not just close)
    - Verify the `validRange` guard correctly enforces the 10–30 candle window (Req 1.7)
    - Verify `rangeAtr` computation uses true range (max(high, prevHigh) − min(low, prevLow)) over the last 20 inside-range candles
    - Confirm all four contraction conditions must be simultaneously true before returning CONTRACTION (Req 1.2)
    - _Requirements: 1.1, 1.2, 1.7_

  - [x] 1.2 Audit and fix breakout detection
    - Confirm the last-5-candle scan uses `.find()` so the first matching candle wins (Req 2.4)
    - Verify `htfBullish` / `htfBearish` logic: `trend === 'UP' || htfAlignment` for bullish; `trend === 'DOWN' || !htfAlignment` for bearish (Req 2.1, 2.2)
    - Confirm `volatilityRegime === 'EXTREME'` blocks breakout regardless of body/volume (Req 2.5)
    - Verify `breakoutLevel` is set to the breakout candle close (Req 2.3)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 1.3 Audit and fix retest detection
    - Verify LONG retest: `c.low <= rh && c.close > rh` with wick ratio `(c.high - c.close) / atr > 0.3` (Req 3.1)
    - Verify SHORT retest: `c.high >= rl && c.close < rl` with wick ratio `(c.close - c.low) / atr > 0.3` (Req 3.2)
    - Confirm `retestLevel === entry2` always (Req 3.3)
    - Confirm that a retest candle failing to close back beyond RH/RL sets `invalidated = true` (Req 3.4)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 1.4 Audit and fix stop-loss computation
    - Verify LONG: `stopLoss = Math.min(rl, breakoutCandleLow) - (atr * 0.1)` (Req 4.1)
    - Verify SHORT: `stopLoss = Math.max(rh, breakoutCandleLow) + (atr * 0.1)` (Req 4.2)
    - Confirm `stopLoss` is always non-null when `rangeState` is BREAKOUT or RETEST (Req 4.3)
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 1.5 Audit and fix take-profit computation
    - Verify LONG: `tp1 = entry1 + (rh - rl)`, `tp2 = entry1 + (rh - rl) * 1.75` (Req 5.1)
    - Verify SHORT: `tp1 = entry1 - (rh - rl)`, `tp2 = entry1 - (rh - rl) * 1.75` (Req 5.2)
    - Confirm `tp1` and `tp2` are always non-null when `rangeState` is BREAKOUT (Req 5.3)
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 1.6 Audit and fix invalidation logic
    - Verify the 3-candle inside-range check uses `candles.slice(-3)` and counts closes in `[rl, rh]` (Req 6.1)
    - Verify LONG invalidation: `sweep && !htfAlignment` (Req 6.2)
    - Verify SHORT invalidation: `sweep && htfAlignment` (Req 6.3)
    - Verify liquidity sweep check: `STOP_CLUSTER` zone midpoint within `atr * 0.2` of current close (Req 6.4)
    - Confirm `invalidated = true` always forces `rangeState = CONTRACTION` (Req 6.5)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 1.7 Enforce output contract and null-field rules
    - When `rangeState` is EXPANSION or CONTRACTION, set `entry1`, `entry2`, `stopLoss`, `tp1`, `tp2`, `retestLevel`, `breakoutDirection` all to null (Req 7.5)
    - Confirm `rh` and `rl` are always sourced from `marketStructure` regardless of state (Req 7.2, 10.1–10.5)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 1.8 Write property tests for BreakoutCycleEngine
    - **Property 1: State consistency** — `∀ output: invalidated = true ⟹ rangeState = CONTRACTION`
    - **Validates: Requirements 6.5, 7.6**
    - **Property 2: TP ordering LONG** — `∀ BREAKOUT LONG output: tp2 > tp1 > entry1 > stopLoss`
    - **Validates: Requirements 5.4**
    - **Property 3: TP ordering SHORT** — `∀ BREAKOUT SHORT output: tp2 < tp1 < entry1 < stopLoss`
    - **Validates: Requirements 5.5**
    - **Property 4: RH/RL passthrough** — `∀ output: output.rh = input.marketStructure.rh AND output.rl = input.marketStructure.rl`
    - **Validates: Requirements 7.2, 10.1, 10.2**
    - Use `fast-check` in `src/tests/property/breakout-cycle.test.ts`

  - [ ]* 1.9 Write unit tests for BreakoutCycleEngine
    - Test MISSING_DATA error when fewer than 10 candles provided (Req 1.4)
    - Test VALIDATION error when ATR ≤ 0 (Req 1.5)
    - Test DEFAULT_OUTPUT returned when rh ≤ rl (Req 1.6)
    - Test CONTRACTION detection with all four conditions true
    - Test BREAKOUT detection blocked when volatilityRegime is EXTREME (Req 2.5)
    - Test each invalidation trigger independently (Req 6.1–6.4)
    - _Requirements: 1.4, 1.5, 1.6, 2.5, 6.1, 6.2, 6.3, 6.4_

- [x] 2. Complete MarketStructureContextEngine range context fields
  - [x] 2.1 Verify rh, rl, rangeState, and breakoutDirection output fields
    - Confirm `rh` is the most recent external swing high price (Req 10.1)
    - Confirm `rl` is the most recent external swing low price (Req 10.2)
    - Confirm `rangeState` is CONTRACTION when `close` is between `rl` and `rh`, EXPANSION otherwise (Req 10.3)
    - Confirm `breakoutDirection` is LONG when `close > rh && trend === 'UP'`, SHORT when `close < rl && trend === 'DOWN'`, null otherwise (Req 10.4)
    - Confirm `rh >= rl` for all outputs (Req 10.5)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 2.2 Write unit tests for MarketStructureContextEngine range fields
    - Test that `rh` and `rl` are populated from detected external swings
    - Test `rh >= rl` invariant across varied candle windows
    - Test `breakoutDirection` null when trend is RANGE
    - _Requirements: 10.1, 10.2, 10.4, 10.5_

- [x] 3. Complete ScoringEngine breakout scoring components
  - [x] 3.1 Verify all four breakout contribution scores
    - Confirm `breakoutStrengthScore` is 0 when `invalidated = true` (Req 8.5)
    - Confirm `retestQualityScore` is 0 when `invalidated = true` (Req 8.5)
    - Confirm all four scores are present as named keys in `contributions` map (Req 8.6)
    - Confirm each score is clamped to `[0, 100]` (Req 8.7)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ]* 3.2 Write property test for ScoringEngine breakout contributions
    - **Property 5: Scoring bounds** — `∀ contributions: breakoutStrength, retestQuality, rangeCompression, volumeExpansion ∈ [0, 100]`
    - **Validates: Requirements 8.7**
    - **Property 6: Invalidation zeroes scores** — `∀ input where breakoutCycle.invalidated = true: breakoutStrength = 0 AND retestQuality = 0`
    - **Validates: Requirements 8.5**
    - Add to `src/tests/property/breakout-cycle.test.ts`

  - [ ]* 3.3 Write unit tests for ScoringEngine breakout scoring
    - Test `breakoutStrengthScore = 90` when `rangeState = BREAKOUT` and not invalidated
    - Test `retestQualityScore = 85` when `retestLevel` is non-null
    - Test all four keys present in contributions for any valid input
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 4. Complete RiskManager fee-aware net profit gate
  - [x] 4.1 Verify feeAwareNetProfit computation and gate
    - Confirm formula: `(targetDistance / currentPrice * 100) - 0.2` (Req 9.1)
    - Confirm `feeAwareNetProfit < 3.0` adds a reject reason and sets `hardReject = true` (Req 9.2)
    - Confirm `feeAwareNetProfit` is always a defined field in `RiskOutput` (Req 9.3)
    - Confirm `BreakoutCycleOutput` is accepted as optional input without failure when absent (Req 9.5)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 4.2 Write property test for RiskManager fee gate
    - **Property 7: Fee gate** — `∀ riskOutput: feeAwareNetProfit < 3.0 ⟹ hardReject = true`
    - **Validates: Requirements 9.4**
    - Add to `src/tests/property/breakout-cycle.test.ts`

  - [ ]* 4.3 Write unit tests for RiskManager fee gate
    - Test `feeAwareNetProfit` is always present in output
    - Test `hardReject = true` when `feeAwareNetProfit = 2.99`
    - Test `hardReject` not forced by fee gate alone when `feeAwareNetProfit = 3.01`
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 5. Checkpoint — Ensure all engine tests pass
  - Run `npx vitest run src/tests/property/breakout-cycle.test.ts` and all related unit tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Verify pipeline integration
  - [x] 6.1 Confirm PipelineOrchestrator sequencing and data flow
    - Confirm `BreakoutCycleEngine` executes after `OrderflowEngine` and before `ScoringEngine` (Req 15.1)
    - Confirm `BreakoutCycleOutput` is passed to both `ScoringEngine` and `RiskManager` in the same cycle (Req 15.2)
    - Confirm `avgRangeBody` and `avgRangeVolume` are computed from the last 20 candles before the call (Req 15.5)
    - Confirm `DEFAULT_BREAKOUT_CYCLE` is used and pipeline marked degraded on `EngineError` (Req 15.4)
    - _Requirements: 15.1, 15.2, 15.4, 15.5_

  - [x] 6.2 Confirm LiveAnalysisResponse includes breakoutCycle field
    - Verify `result.geometry.breakoutCycle` is mapped to `response.breakoutCycle` in `server.ts` (Req 15.3)
    - Verify `GeometryBundle` type includes `breakoutCycle` as non-optional (Req 16.1)
    - _Requirements: 15.3, 16.1_

  - [ ]* 6.3 Add breakoutCycle to engine snapshot test
    - Extend `src/tests/snapshot/engines.test.ts` to include `breakoutCycle` in the snapshot assertion
    - _Requirements: 16.1, 16.4_

  - [ ]* 6.4 Write integration test for breakoutCycle round-trip
    - In `src/tests/integration/pipeline.test.ts`, assert that `PipelineOrchestrator.run()` returns a `breakoutCycle` field with a valid `rangeState`
    - Assert `breakoutCycle` values are unchanged between pipeline output and `LiveAnalysisResponse`
    - _Requirements: 16.1, 16.2, 16.4_

- [x] 7. Complete frontend liveStore and data flow
  - [x] 7.1 Verify liveStore stores breakoutCycle without mutation
    - Confirm `setLiveData` assigns `data.breakoutCycle` directly to `breakoutCycle` state without transformation (Req 16.2)
    - Confirm `clearData` resets `breakoutCycle` to null
    - _Requirements: 16.2, 16.3_

- [x] 8. Complete AlertsPanel breakout alert wiring
  - [x] 8.1 Verify all six breakout alert types in useLiveAnalysis hook
    - Confirm `BREAKOUT DETECTED` fires on `rangeState` transition to BREAKOUT with `invalidated = false` (Req 13.1)
    - Confirm `RETEST AVAILABLE` fires when `retestLevel` transitions from null to non-null (Req 13.2)
    - Confirm `STOP LOSS UPDATE` fires when `stopLoss` value changes while in BREAKOUT or RETEST (Req 13.3)
    - Confirm `TP1 HIT` fires when `currentPrice` crosses `tp1` in the correct direction for LONG and SHORT (Req 13.4, 13.5)
    - Confirm `TP2 HIT` fires when `currentPrice` crosses `tp2` in the correct direction (Req 13.6, 13.7)
    - Confirm `BREAKOUT INVALIDATED` fires on `invalidated` transition to true with severity `critical` (Req 13.8)
    - Fix SHORT TP1/TP2 hit detection: current implementation only checks upward crosses; add downward cross check for SHORT direction
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_

  - [x] 8.2 Implement standalone high-probability alert
    - In `useLiveAnalysis`, when `scoring.probability >= 80` and `risk.hardReject = false`, call `addAlert` with message including the probability value and severity `info` (Req 11.1, 11.2)
    - When probability drops below 80, do not re-emit the alert (edge: only fire on transition above threshold) (Req 11.3)
    - Add `prevHighProbAlert` ref to track previous state
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ]* 8.3 Write unit tests for alert wiring
    - Test `BREAKOUT DETECTED` fires exactly once on state transition, not on every cycle
    - Test `BREAKOUT INVALIDATED` uses severity `critical`
    - Test SHORT TP1/TP2 hit detection fires on downward price cross
    - Test high-probability alert fires only when transitioning above 80%
    - _Requirements: 11.1, 13.1, 13.5, 13.7, 13.8_

- [x] 9. Complete PredictionChart breakout overlays
  - [x] 9.1 Add breakout arrow marker SVG element
    - When `rangeState === 'BREAKOUT'` and `invalidated = false`, render an upward (LONG) or downward (SHORT) arrow at the normalized `breakoutLevel` price position on the chart (Req 12.1)
    - Use `normalizePrice(breakoutCycle.breakoutLevel)` and `scaleY()` to position the arrow
    - Arrow should be visually distinct from the existing level lines (e.g., filled triangle polygon)
    - _Requirements: 12.1_

  - [x] 9.2 Add retest marker SVG element
    - When `rangeState === 'RETEST'` and `invalidated = false`, render a circle or target marker at the normalized `retestLevel` price position (Req 12.2)
    - _Requirements: 12.2_

  - [x] 9.3 Clear markers when invalidated
    - Confirm both the breakout arrow and retest marker are conditionally rendered only when `invalidated = false` (Req 12.3)
    - _Requirements: 12.3_

  - [x] 9.4 Verify range box and level lines
    - Confirm the range box renders whenever `rh > 0 && rl > 0` (Req 12.4)
    - Confirm `entry1`, `entry2` (if non-null), `stopLoss`, `tp1`, `tp2` lines render during BREAKOUT or RETEST states (Req 12.5)
    - _Requirements: 12.4, 12.5_

  - [ ]* 9.5 Write unit tests for PredictionChart breakout overlays
    - Test breakout arrow renders when `rangeState = BREAKOUT` and `invalidated = false`
    - Test retest marker renders when `rangeState = RETEST` and `invalidated = false`
    - Test neither marker renders when `invalidated = true`
    - Test range box renders when `rh > 0 && rl > 0`
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 10. Verify BreakoutCyclePanel HUD display
  - [x] 10.1 Confirm all display fields and labels
    - Confirm color-coded badge for each `rangeState` (EXPANSION: neutral, CONTRACTION: yellow, BREAKOUT: green, RETEST: blue) (Req 14.1)
    - Confirm `entry1` is labeled "Level 1 (Breakout)" (Req 14.4)
    - Confirm `entry2` is labeled "Level 2 (Retest)" (Req 14.5)
    - Confirm `stopLoss` is labeled "Structural Stop" in red (Req 14.6)
    - Confirm `tp1` is labeled "Target 1 (Range)" in green (Req 14.7)
    - Confirm `tp2` is labeled "Target 2 (Expansion)" in green (Req 14.8)
    - Confirm "INVALIDATED" badge renders in red when `invalidated = true` (Req 14.9)
    - Confirm "Awaiting data…" renders when `breakoutCycle = null` (Req 14.10)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10_

  - [ ]* 10.2 Write unit tests for BreakoutCyclePanel
    - Test "Awaiting data…" renders when store has `breakoutCycle = null`
    - Test INVALIDATED badge renders when `invalidated = true`
    - Test all level labels render with correct text when fields are non-null
    - Test correct badge color for each `rangeState`
    - _Requirements: 14.1, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Run `npx vitest run` to execute the full test suite
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Most engine code already exists — tasks 1–4 are primarily audit-and-fix, not greenfield
- Property tests use `fast-check` (already in dev dependencies at `src/tests/property/`)
- The SHORT direction TP hit detection in `useLiveAnalysis.ts` is a known gap (task 8.1)
- The breakout arrow and retest marker SVG elements in `PredictionChart.tsx` are the only missing visual elements (tasks 9.1–9.2)
