// Unit tests for SliderPanel weight guard and normalization
// Requirements: 23.4, 23.5

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SliderPanel } from './SliderPanel.js';

const WEIGHT_MIN = 0.05;
const WEIGHT_MAX = 0.60;

describe('SliderPanel', () => {
    it('renders weight sliders', () => {
        render(<SliderPanel />);
        const header = screen.getByText(/Engine Weights/i);
        fireEvent.click(header);
        expect(screen.getByLabelText(/Weight for G/i)).toBeDefined();
    });

    it('Weight Guard: slider min is 0.05', () => {
        render(<SliderPanel />);
        const header = screen.getByText(/Engine Weights/i);
        fireEvent.click(header);
        const slider = screen.getByLabelText(/Weight for G/i) as HTMLInputElement;
        expect(parseFloat(slider.min)).toBe(WEIGHT_MIN);
    });

    it('Weight Guard: slider max is 0.60', () => {
        render(<SliderPanel />);
        const header = screen.getByText(/Engine Weights/i);
        fireEvent.click(header);
        const slider = screen.getByLabelText(/Weight for G/i) as HTMLInputElement;
        expect(parseFloat(slider.max)).toBe(WEIGHT_MAX);
    });

    it('weight normalization: all weights sum to 1.0 after adjustment', () => {
        render(<SliderPanel />);
        const header = screen.getByText(/Engine Weights/i);
        fireEvent.click(header);
        const slider = screen.getByLabelText(/Weight for G/i) as HTMLInputElement;
        fireEvent.change(slider, { target: { value: '0.30' } });

        // All weight value displays should sum to ~1.0
        const weightValues = screen.getAllByText(/^0\.\d{2}$/).map(el => parseFloat(el.textContent ?? '0'));
        const sum = weightValues.reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 1);
    });
});
