import type {
    Engine,
    EngineError,
    MicrostructureOutput,
    OrderflowOutput,
} from '../../../shared/types/index.js';

export interface OrderflowInput {
    bid: number;
    ask: number;
    footprintLevels: Array<{ price: number; bidVolume: number; askVolume: number }>;
    microstructure: MicrostructureOutput;
    previousCvd?: number;
}

export const OrderflowEngine: Engine<OrderflowInput, OrderflowOutput> = {
    name: 'OrderflowEngine',
    version: '1.0.0',

    execute(input: OrderflowInput): OrderflowOutput | EngineError {
        // Validation
        if (
            input == null ||
            typeof input.bid !== 'number' ||
            typeof input.ask !== 'number' ||
            isNaN(input.bid) ||
            isNaN(input.ask) ||
            input.bid < 0 ||
            input.ask < 0
        ) {
            return {
                type: 'VALIDATION',
                message: 'bid and ask must be non-negative, non-NaN numbers',
                recoverable: false,
            };
        }

        const { bid, ask, footprintLevels, previousCvd } = input;

        // delta
        const delta = ask - bid;

        // cvd
        const cvd = (previousCvd ?? 0) + delta;

        // absorption: delta < 5% of total volume
        const totalVolume = bid + ask;
        const absorption = totalVolume > 0 && Math.abs(delta) < totalVolume * 0.05;

        // footprintImbalance: average (askVolume - bidVolume) / (askVolume + bidVolume) per level
        let footprintImbalance = 0;
        if (footprintLevels && footprintLevels.length > 0) {
            const sum = footprintLevels.reduce((acc, level) => {
                const levelTotal = level.askVolume + level.bidVolume;
                if (levelTotal === 0) return acc;
                return acc + (level.askVolume - level.bidVolume) / levelTotal;
            }, 0);
            footprintImbalance = sum / footprintLevels.length;
        }

        // bidAskPressure: (ask - bid) / (bid + ask), 0 if total is 0
        const bidAskPressure = totalVolume === 0 ? 0 : (ask - bid) / totalVolume;

        return {
            delta,
            cvd,
            absorption,
            footprintImbalance,
            bidAskPressure,
        };
    },
};
