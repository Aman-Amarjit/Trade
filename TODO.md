# BreakoutCycleEngine Implementation TODO
Version: 1.0 | Current: Step 1/22 | Backend: 0/12 | Frontend: 0/10

## Backend (Priority 1)
- [x] 1. shared/types/index.ts: Add BreakoutCycleInput/Output interfaces
- [x] 2. src/engines/geometry/BreakoutCycleEngine.ts: Create NEW engine file (full logic)
- [x] 3. src/engines/geometry/index.ts: Export engine + types
- [ ] 4. src/pipeline/PipelineOrchestrator.ts: Import, execute after Orderflow, add to geometryBundle
- [x] 5. src/engines/structure/MarketStructureContextEngine.ts: Extend output (rangeState/RH/RL/breakoutDirection)

- [ ] 6. src/engines/decision/ScoringEngine.ts: +4 scores (breakoutStrength etc.)
- [ ] 7. src/engines/decision/RiskManager.ts: +feeAwareNetProfit reject
- [ ] 8. src/tests/snapshot/engines.test.ts: Add snapshot tests
- [ ] 9. Verify: `npm run build` (no TS errors)
- [ ] 10. Verify: `vitest src/tests/snapshot/` (snapshots pass)

## Frontend (Priority 2)
- [ ] 11. frontend/src/state/liveStore.ts: +breakoutCycle field + setLiveData
- [ ] 12. frontend/src/components/GeometryPanel.tsx: +range box/gauges/entry/SL/TP
- [ ] 13. frontend/src/components/PredictionGraph.tsx: +range overlay/arrows/markers
- [ ] 14. frontend/src/components/AlertsPanel.tsx: +6 breakout alerts
- [ ] 15. frontend/src/components/MicrostructurePanel.tsx: +retest/breakout badges
- [ ] 16. frontend/src/pages/LiveAnalysisPage.tsx: +HUD rangeState/breakoutDirection
- [ ] 17. frontend/src/components/GeometryPanel.test.tsx: Update tests
- [ ] 18. Verify: `cd frontend && npm run dev` (no errors, new UI renders)

## Final
- [ ] 19. CHECKLIST.md: Create w/ backend/frontend checklists (mark [x])
- [ ] 20. Update README.md/COMPONENT_MAP.md if needed
- [ ] 21. Full e2e test: LiveAnalysisPage shows range/breakout/alerts
- [ ] 22. `attempt_completion`

**Next: Types → Engine → Pipeline → Tests → Frontend**

