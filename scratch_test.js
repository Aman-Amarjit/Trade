import { PipelineOrchestrator } from './src/pipeline/PipelineOrchestrator.js';
const po = new PipelineOrchestrator();
const mockBundle = {
    seq: 1,
    price: { open: 100, high: 105, low: 95, close: 102, mid: 100 },
    volume: { raw: 1000, relative: 1, delta: 100, cvd: 100 },
    orderflow: { bid: 500, ask: 500, imbalance: 0 },
    volatility: { atr: 5, atrNorm: 0.05, atrPercentile: 0.5, bandwidth: 0.05 },
    structure: { swings: [], trend: 'RANGE', internal: [], external: [] },
    liquidity: { fvg: [], stopClusters: [], liqShelves: [] },
    macro: { dxy: 100, vix: 20, spx: 4000, gold: 2000, sentiment: 0.5, fundingRate: 0.01, etfFlows: 100 },
    session: { type: 'NEWYORK', volatilityPattern: 0.5 },
    timestamp: new Date().toISOString()
};

async function test() {
    const res = await po.run(mockBundle as any, []);
    console.log('Engine Rate:', res.engineRate);
    console.log('Rejection Ratio:', res.rejectionRatio);
    console.log('Full keys:', Object.keys(res));
}
test();
