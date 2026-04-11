# Requirements Document

## Introduction

The BreakoutCycleEngine (Engine #15) is a deterministic entry/exit analysis engine added to the V4.0 bot pipeline. It identifies four range-cycle phases in price action — EXPANSION, CONTRACTION, BREAKOUT, and RETEST — and emits structured analytical outputs including entry levels, stop-loss, and take-profit targets. These outputs are consumed by the ScoringEngine, RiskManager, MarketStructureContextEngine, and the frontend HUD/AlertsPanel. The engine also unblocks previously non-implementable features: standalone high-probability alerts (≥80%), chart markers for breakout and retest events, and recommended stop/entry/net-profit-after-fees display.

All outputs are analytical only. Trade execution is not in scope.

---

## Glossary

- **BreakoutCycleEngine**: Engine #15 in the pipeline. Detects range phases and emits entry/exit analytical levels.
- **RangeState**: One of four states — `EXPANSION`, `CONTRACTION`, `BREAKOUT`, `RETEST` — describing the current market cycle phase.
- **RH**: Recent swing high — the upper boundary of the detected range.
- **RL**: Recent swing low — the lower boundary of the detected range.
- **ATR**: Average True Range — a measure of market volatility used as a distance unit.
- **avgRangeBody**: Average candle body size (|close − open|) computed over the last 20 candles inside the range.
- **avgRangeVolume**: Average candle volume computed over the last 20 candles inside the range.
- **HTF**: Higher Time Frame — the broader trend context provided by MarketStructureContextEngine.
- **entry1**: Breakout entry level — the close price of the breakout candle.
- **entry2**: Retest entry level — RH (or RL) plus a small ATR-based buffer.
- **stopLoss**: Structural stop-loss level derived from the range low/high and breakout candle.
- **tp1**: First take-profit target — entry plus one range size.
- **tp2**: Second take-profit target — entry plus k × range size (k = 1.5–2.0).
- **invalidated**: Boolean flag indicating the breakout setup has been voided.
- **feeAwareNetProfit**: Predicted profit percentage minus estimated fees percentage.
- **breakoutStrengthScore**: ScoringEngine contribution [0–100] measuring breakout candle strength.
- **retestQualityScore**: ScoringEngine contribution [0–100] measuring retest setup quality.
- **rangeCompressionScore**: ScoringEngine contribution [0–100] measuring degree of range contraction.
- **volumeExpansionScore**: ScoringEngine contribution [0–100] measuring volume expansion on breakout.
- **ScoringEngine**: Decision engine that computes a probability score [0–100] from all engine outputs.
- **RiskManager**: Decision engine that applies hard-reject gates including the fee-aware net profit gate.
- **MarketStructureContextEngine**: Structure engine that provides RH, RL, trend, and rangeState to downstream engines.
- **MicroStructureEngine**: Geometry engine that provides sweep, htfAlignment, and divergence signals.
- **LiquidityMapEngine**: Structure engine that provides liquidity zones including stop clusters.
- **VolatilityRegimeEngine**: Context engine that classifies volatility as LOW, NORMAL, HIGH, or EXTREME.
- **PipelineOrchestrator**: Sequences all 15 engines and assembles the LiveAnalysisResponse.
- **BreakoutCyclePanel**: Frontend HUD panel displaying range state, RH/RL, and analytical levels.
- **PredictionChart**: Frontend SVG chart displaying alignment score history with breakout overlays.
- **AlertsPanel**: Frontend panel displaying system notifications and breakout-specific alerts.
- **HUD**: Heads-Up Display — the frontend dashboard.

---

## Requirements

### Requirement 1: Range Detection

**User Story:** As a trader, I want the system to detect when price is contracting inside a defined range, so that I can identify potential breakout setups before they occur.

#### Acceptance Criteria

1. WHEN at least 10 candles have closed with their low ≥ RL and high ≤ RH, THE BreakoutCycleEngine SHALL evaluate the range for contraction conditions.
2. WHEN the range ATR (computed over the last 20 candles inside the range) is less than 0.8 × the current ATR, AND candle bodies are shrinking (average recent body < 0.9 × avgRangeBody), AND volume is stable or declining (average recent volume ≤ 1.1 × avgRangeVolume), AND at least 10 candles are inside the range, THE BreakoutCycleEngine SHALL set rangeState to CONTRACTION.
3. THE BreakoutCycleEngine SHALL source RH and RL exclusively from MarketStructureContextEngine output.
4. IF the number of candles provided is fewer than 10, THEN THE BreakoutCycleEngine SHALL return a recoverable MISSING_DATA error.
5. IF ATR is less than or equal to zero, THEN THE BreakoutCycleEngine SHALL return a non-recoverable VALIDATION error.
6. IF RH is less than or equal to RL, THEN THE BreakoutCycleEngine SHALL return the default output with rangeState set to EXPANSION.
7. THE BreakoutCycleEngine SHALL accept between 10 and 30 candles as the valid range window for contraction detection.

---

### Requirement 2: Breakout Detection

**User Story:** As a trader, I want the system to confirm a breakout from the range with objective criteria, so that I receive high-confidence breakout signals rather than false positives.

#### Acceptance Criteria

1. WHEN the current candle closes above RH, AND the candle body is at least 1.5 × avgRangeBody, AND the candle volume is at least 1.5 × avgRangeVolume, AND the HTF trend is bullish (MarketStructureContextEngine trend = UP or MicroStructureEngine htfAlignment = true), AND the VolatilityRegime is not EXTREME, THE BreakoutCycleEngine SHALL set rangeState to BREAKOUT, breakoutDirection to LONG, and entry1 to the breakout candle close price.
2. WHEN the current candle closes below RL, AND the candle body is at least 1.5 × avgRangeBody, AND the candle volume is at least 1.5 × avgRangeVolume, AND the HTF trend is bearish (MarketStructureContextEngine trend = DOWN or MicroStructureEngine htfAlignment = false), AND the VolatilityRegime is not EXTREME, THE BreakoutCycleEngine SHALL set rangeState to BREAKOUT, breakoutDirection to SHORT, and entry1 to the breakout candle close price.
3. WHILE rangeState is BREAKOUT, THE BreakoutCycleEngine SHALL set breakoutLevel to the breakout candle close price.
4. THE BreakoutCycleEngine SHALL scan the last 5 candles for a breakout candidate and use the first matching candle found.
5. WHILE VolatilityRegime is EXTREME, THE BreakoutCycleEngine SHALL NOT confirm a breakout regardless of body or volume conditions.

---

### Requirement 3: Retest Entry Detection

**User Story:** As a trader, I want the system to detect when price retests the broken level after a breakout, so that I can identify a lower-risk secondary entry opportunity.

#### Acceptance Criteria

1. WHEN rangeState is BREAKOUT and breakoutDirection is LONG, AND a candle's low touches or crosses below RH, AND the candle closes back above RH, AND the candle exhibits a rejection wick (wick-to-ATR ratio > 0.3), THE BreakoutCycleEngine SHALL set rangeState to RETEST and entry2 to RH + (ATR × 0.1).
2. WHEN rangeState is BREAKOUT and breakoutDirection is SHORT, AND a candle's high touches or crosses above RL, AND the candle closes back below RL, AND the candle exhibits a rejection wick (wick-to-ATR ratio > 0.3), THE BreakoutCycleEngine SHALL set rangeState to RETEST and entry2 to RL − (ATR × 0.1).
3. WHILE rangeState is RETEST, THE BreakoutCycleEngine SHALL set retestLevel equal to entry2.
4. IF a retest candle fails to close back beyond RH (LONG) or RL (SHORT), THEN THE BreakoutCycleEngine SHALL set invalidated to true.

---

### Requirement 4: Stop-Loss Computation

**User Story:** As a trader, I want the system to compute a structural stop-loss level for each breakout, so that I have a defined risk boundary for the trade setup.

#### Acceptance Criteria

1. WHEN breakoutDirection is LONG, THE BreakoutCycleEngine SHALL set stopLoss to the minimum of RL and the breakout candle low, minus (ATR × 0.1).
2. WHEN breakoutDirection is SHORT, THE BreakoutCycleEngine SHALL set stopLoss to the maximum of RH and the breakout candle low, plus (ATR × 0.1).
3. WHILE rangeState is BREAKOUT or RETEST, THE BreakoutCycleEngine SHALL always emit a non-null stopLoss value.

---

### Requirement 5: Take-Profit Computation

**User Story:** As a trader, I want the system to compute two take-profit targets based on the range size, so that I have structured exit levels for partial and full position management.

#### Acceptance Criteria

1. WHEN breakoutDirection is LONG, THE BreakoutCycleEngine SHALL set tp1 to entry1 + (RH − RL) and tp2 to entry1 + (RH − RL) × 1.75.
2. WHEN breakoutDirection is SHORT, THE BreakoutCycleEngine SHALL set tp1 to entry1 − (RH − RL) and tp2 to entry1 − (RH − RL) × 1.75.
3. WHILE rangeState is BREAKOUT, THE BreakoutCycleEngine SHALL always emit non-null tp1 and tp2 values.
4. FOR ALL valid LONG breakout outputs, tp2 SHALL be greater than tp1, and tp1 SHALL be greater than entry1, and entry1 SHALL be greater than stopLoss.
5. FOR ALL valid SHORT breakout outputs, tp2 SHALL be less than tp1, and tp1 SHALL be less than entry1, and entry1 SHALL be less than stopLoss.

---

### Requirement 6: Breakout Invalidation

**User Story:** As a trader, I want the system to detect when a breakout setup has failed, so that I am not holding a position against a reversed structure.

#### Acceptance Criteria

1. WHEN rangeState is BREAKOUT or RETEST, AND at least 3 of the last 3 candles close inside the range (RL ≤ close ≤ RH), THE BreakoutCycleEngine SHALL set invalidated to true and rangeState to CONTRACTION.
2. WHEN breakoutDirection is LONG AND MicroStructureEngine reports a sweep AND htfAlignment is false, THE BreakoutCycleEngine SHALL set invalidated to true.
3. WHEN breakoutDirection is SHORT AND MicroStructureEngine reports a sweep AND htfAlignment is true, THE BreakoutCycleEngine SHALL set invalidated to true.
4. WHEN a LiquidityMapEngine STOP_CLUSTER zone midpoint is within 0.2 × ATR of the current close price, THE BreakoutCycleEngine SHALL set invalidated to true.
5. FOR ALL outputs where invalidated is true, THE BreakoutCycleEngine SHALL set rangeState to CONTRACTION.

---

### Requirement 7: Output Contract and State Consistency

**User Story:** As a pipeline engineer, I want the BreakoutCycleEngine to always emit a well-formed, consistent output, so that downstream engines can rely on it without defensive null-checking.

#### Acceptance Criteria

1. THE BreakoutCycleEngine SHALL always emit a rangeState value that is one of: EXPANSION, CONTRACTION, BREAKOUT, or RETEST.
2. THE BreakoutCycleEngine SHALL always emit rh and rl values sourced from MarketStructureContextEngine, regardless of rangeState.
3. WHEN rangeState is BREAKOUT, THE BreakoutCycleEngine SHALL emit non-null values for entry1, stopLoss, tp1, and tp2.
4. WHEN rangeState is RETEST, THE BreakoutCycleEngine SHALL emit non-null values for entry2 and retestLevel.
5. WHEN rangeState is EXPANSION or CONTRACTION, THE BreakoutCycleEngine SHALL emit null for entry1, entry2, stopLoss, tp1, tp2, retestLevel, and breakoutDirection.
6. FOR ALL outputs, invalidated equal to true SHALL imply rangeState equal to CONTRACTION.

---

### Requirement 8: ScoringEngine Integration — Breakout Scoring Components

**User Story:** As a system designer, I want the ScoringEngine to incorporate breakout-specific signals into the probability score, so that breakout setups are properly weighted in the overall trade quality assessment.

#### Acceptance Criteria

1. THE ScoringEngine SHALL compute a breakoutStrengthScore in the range [0, 100] based on the BreakoutCycleEngine rangeState and breakoutLevel.
2. THE ScoringEngine SHALL compute a retestQualityScore in the range [0, 100] based on the presence of a retestLevel in the BreakoutCycleEngine output.
3. THE ScoringEngine SHALL compute a rangeCompressionScore in the range [0, 100] based on whether rangeState is CONTRACTION, BREAKOUT, or other.
4. THE ScoringEngine SHALL compute a volumeExpansionScore in the range [0, 100] based on whether rangeState is BREAKOUT and invalidated is false.
5. WHEN BreakoutCycleEngine output has invalidated equal to true, THE ScoringEngine SHALL set breakoutStrengthScore to 0 and retestQualityScore to 0.
6. THE ScoringEngine SHALL include all four breakout scores as named entries in the contributions output map.
7. FOR ALL scoring outputs, each breakout contribution value SHALL be in the range [0, 100].

---

### Requirement 9: RiskManager Integration — Fee-Aware Net Profit Gate

**User Story:** As a risk manager, I want the system to reject trade setups where the predicted profit does not exceed fees by a meaningful margin, so that the bot does not enter trades that are unprofitable after costs.

#### Acceptance Criteria

1. THE RiskManager SHALL compute feeAwareNetProfit as (targetDistance / currentPrice × 100) − 0.2.
2. WHEN feeAwareNetProfit is less than 3.0 percent, THE RiskManager SHALL add a rejection reason to rejectReasons and set hardReject to true.
3. THE RiskManager SHALL always include feeAwareNetProfit as a non-undefined field in RiskOutput.
4. FOR ALL RiskOutput values where feeAwareNetProfit is less than 3.0, hardReject SHALL be true.
5. THE RiskManager SHALL accept BreakoutCycleOutput as an optional input field without failing when it is absent.

---

### Requirement 10: MarketStructureContextEngine — Range Context Exposure

**User Story:** As a pipeline engineer, I want the MarketStructureContextEngine to expose range context fields so that the BreakoutCycleEngine and downstream consumers have a consistent source of truth for RH, RL, and breakout direction.

#### Acceptance Criteria

1. THE MarketStructureContextEngine SHALL always emit rh as the price of the most recent external swing high detected in the candle window.
2. THE MarketStructureContextEngine SHALL always emit rl as the price of the most recent external swing low detected in the candle window.
3. THE MarketStructureContextEngine SHALL emit rangeState as CONTRACTION when the current close is between rl and rh, and EXPANSION otherwise.
4. THE MarketStructureContextEngine SHALL emit breakoutDirection as LONG when the current close is above rh and trend is UP, SHORT when the current close is below rl and trend is DOWN, and null otherwise.
5. FOR ALL MarketStructureOutput values, rh SHALL be greater than or equal to rl.

---

### Requirement 11: Standalone High-Probability Alert

**User Story:** As a trader, I want to receive an alert when the system probability reaches or exceeds 80% independently of the breakout state, so that I am notified of high-confidence setups even outside of active breakout cycles.

#### Acceptance Criteria

1. WHEN ScoringEngine probability is greater than or equal to 80 and RiskManager hardReject is false, THE AlertsPanel SHALL display a standalone high-probability alert with severity "info".
2. THE AlertsPanel SHALL display the probability value in the alert message.
3. WHEN ScoringEngine probability drops below 80, THE AlertsPanel SHALL remove the standalone high-probability alert.

---

### Requirement 12: Breakout and Retest Chart Markers

**User Story:** As a trader, I want to see visual markers on the chart when a breakout is confirmed and when a retest is available, so that I can quickly identify the current cycle phase without reading text panels.

#### Acceptance Criteria

1. WHEN BreakoutCycleEngine rangeState is BREAKOUT and invalidated is false, THE PredictionChart SHALL render a breakout arrow marker at the breakout level on the chart.
2. WHEN BreakoutCycleEngine rangeState is RETEST and invalidated is false, THE PredictionChart SHALL render a retest marker at the retestLevel on the chart.
3. WHEN BreakoutCycleEngine invalidated is true, THE PredictionChart SHALL remove both the breakout arrow and retest marker.
4. THE PredictionChart SHALL render a range box overlay spanning from RL to RH whenever rh and rl are non-zero.
5. WHEN BreakoutCycleEngine rangeState is BREAKOUT or RETEST, THE PredictionChart SHALL render horizontal lines for entry1, entry2 (if non-null), stopLoss, tp1, and tp2 at their respective normalized price positions.

---

### Requirement 13: Breakout-Specific Alerts

**User Story:** As a trader, I want to receive specific alerts for each significant breakout cycle event, so that I can act on time-sensitive information without watching the screen continuously.

#### Acceptance Criteria

1. WHEN BreakoutCycleEngine rangeState transitions to BREAKOUT and invalidated is false, THE AlertsPanel SHALL emit a "BREAKOUT DETECTED" alert with severity "info".
2. WHEN BreakoutCycleEngine rangeState transitions to RETEST and invalidated is false, THE AlertsPanel SHALL emit a "RETEST AVAILABLE" alert with severity "info".
3. WHEN RiskManager stopDistance changes while rangeState is BREAKOUT or RETEST, THE AlertsPanel SHALL emit a "STOP LOSS UPDATE" alert with severity "warning".
4. WHEN the current price reaches or exceeds tp1 while rangeState is BREAKOUT or RETEST and breakoutDirection is LONG, THE AlertsPanel SHALL emit a "TP1 HIT" alert with severity "info".
5. WHEN the current price reaches or falls below tp1 while rangeState is BREAKOUT or RETEST and breakoutDirection is SHORT, THE AlertsPanel SHALL emit a "TP1 HIT" alert with severity "info".
6. WHEN the current price reaches or exceeds tp2 while breakoutDirection is LONG, THE AlertsPanel SHALL emit a "TP2 HIT" alert with severity "info".
7. WHEN the current price reaches or falls below tp2 while breakoutDirection is SHORT, THE AlertsPanel SHALL emit a "TP2 HIT" alert with severity "info".
8. WHEN BreakoutCycleEngine invalidated transitions to true, THE AlertsPanel SHALL emit a "BREAKOUT INVALIDATED" alert with severity "critical".

---

### Requirement 14: BreakoutCyclePanel HUD Display

**User Story:** As a trader, I want a dedicated HUD panel showing all breakout cycle outputs in one place, so that I can monitor the current range state, levels, and trade context at a glance.

#### Acceptance Criteria

1. THE BreakoutCyclePanel SHALL display the current rangeState with a color-coded badge (EXPANSION: neutral, CONTRACTION: yellow, BREAKOUT: green, RETEST: blue).
2. THE BreakoutCyclePanel SHALL display RH and RL values when they are non-zero.
3. WHEN breakoutDirection is non-null, THE BreakoutCyclePanel SHALL display the direction with a directional indicator (LONG: green upward, SHORT: red downward).
4. WHEN entry1 is non-null, THE BreakoutCyclePanel SHALL display it labeled as "Level 1 (Breakout)".
5. WHEN entry2 is non-null, THE BreakoutCyclePanel SHALL display it labeled as "Level 2 (Retest)".
6. WHEN stopLoss is non-null, THE BreakoutCyclePanel SHALL display it labeled as "Structural Stop" in red.
7. WHEN tp1 is non-null, THE BreakoutCyclePanel SHALL display it labeled as "Target 1 (Range)" in green.
8. WHEN tp2 is non-null, THE BreakoutCyclePanel SHALL display it labeled as "Target 2 (Expansion)" in green.
9. WHEN invalidated is true, THE BreakoutCyclePanel SHALL display an "INVALIDATED" badge in red.
10. WHEN BreakoutCycleEngine output is null or unavailable, THE BreakoutCyclePanel SHALL display "Awaiting data…".

---

### Requirement 15: Pipeline Integration

**User Story:** As a pipeline engineer, I want the BreakoutCycleEngine to be correctly sequenced in the pipeline after the geometry engines and before the decision engines, so that its outputs are available to ScoringEngine and RiskManager in the same cycle.

#### Acceptance Criteria

1. THE PipelineOrchestrator SHALL execute BreakoutCycleEngine after OrderflowEngine and before ScoringEngine in every pipeline cycle.
2. THE PipelineOrchestrator SHALL pass BreakoutCycleOutput to both ScoringEngine and RiskManager in the same pipeline cycle.
3. THE PipelineOrchestrator SHALL include BreakoutCycleOutput in the LiveAnalysisResponse sent to the frontend.
4. IF BreakoutCycleEngine returns an EngineError, THEN THE PipelineOrchestrator SHALL use the default BreakoutCycleOutput (rangeState = EXPANSION, all levels null, invalidated = false) and mark the pipeline as degraded.
5. THE PipelineOrchestrator SHALL compute avgRangeBody and avgRangeVolume from the last 20 candles before passing them to BreakoutCycleEngine.

---

### Requirement 16: Round-Trip Data Integrity

**User Story:** As a pipeline engineer, I want the BreakoutCycleEngine outputs to pass through the pipeline and reach the frontend without data loss or mutation, so that the HUD always reflects the engine's actual output.

#### Acceptance Criteria

1. FOR ALL BreakoutCycleOutput values emitted by BreakoutCycleEngine, THE PipelineOrchestrator SHALL include the same values unchanged in the LiveAnalysisResponse breakoutCycle field.
2. FOR ALL LiveAnalysisResponse values received by the frontend, THE liveStore SHALL store the breakoutCycle field without mutation.
3. FOR ALL breakoutCycle values in the liveStore, THE BreakoutCyclePanel SHALL render the values as received without transformation.
4. THE BreakoutCycleEngine SHALL produce identical output for identical inputs (deterministic, no side effects).
