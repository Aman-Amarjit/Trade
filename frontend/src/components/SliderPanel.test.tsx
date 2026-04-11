// Unit tests for SliderPanel weight guard and normalization
// Requirements: 23.4, 23.5

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { SliderPanel } from './SliderPanel.js';


const WEIGHT_MIN = 0.05;
const WEIGHT_MAX = 0.60;

describe('SliderPanel', () => {
    it('renders weights correctly', async () => {
        render(<SliderPanel />);
        const header = await screen.findByText(/Engine Weights/i);
        fireEvent.click(header);
        expect(await screen.findByLabelText(/Weight for G/i)).toBeDefined();
    });

    it('updates local display on weight change', async () => {
        render(<SliderPanel />);
        const header = await screen.findByText(/Engine Weights/i);
        fireEvent.click(header);

        const input = await screen.findByLabelText(/Weight for G/i) as HTMLInputElement;
        
        // Use act to wrap state-changing fireEvent
        await act(async () => {
             fireEvent.change(input, { target: { value: '0.45' } });
        });

        // The component uses local state for weights, so we check the displayed value
        // The value display is next to the slider
        expect(await screen.findByText('0.45')).toBeDefined();
    });

    it('Weight Guard: slider min is 0.05', async () => {
        render(<SliderPanel />);
        const header = await screen.findByText(/Engine Weights/i);
        fireEvent.click(header);
        const slider = await screen.findByLabelText(/Weight for G/i) as HTMLInputElement;
        expect(parseFloat(slider.min)).toBe(WEIGHT_MIN);
    });

    it('Weight Guard: slider max is 0.60', async () => {
        render(<SliderPanel />);
        const header = await screen.findByText(/Engine Weights/i);
        fireEvent.click(header);
        const slider = await screen.findByLabelText(/Weight for G/i) as HTMLInputElement;
        expect(parseFloat(slider.max)).toBe(WEIGHT_MAX);
    });

    it('weight normalization: all weights sum to 1.0 after adjustment', async () => {
        render(<SliderPanel />);
        const header = await screen.findByText(/Engine Weights/i);
        fireEvent.click(header);
        const slider = await screen.findByLabelText(/Weight for G/i) as HTMLInputElement;
        
        await act(async () => {
            fireEvent.change(slider, { target: { value: '0.30' } });
        });

        // All weight value displays should sum to ~1.0
        const weightValueElements = await screen.findAllByText(/^0\.\d{2}$/);
        const weightValues = weightValueElements.map(el => parseFloat(el.textContent ?? '0'));
        const sum = weightValues.reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 1);
    });
});
