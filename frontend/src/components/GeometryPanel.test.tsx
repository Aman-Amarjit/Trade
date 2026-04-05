// Unit tests for GeometryPanel null data display
// Requirements: 25.4

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { GeometryPanel } from './GeometryPanel.js';
import { useLiveStore } from '../state/liveStore';

describe('GeometryPanel', () => {
    beforeEach(() => {
        useLiveStore.setState({ geometry: null });
    });

    it('shows awaiting message when no data', () => {
        render(<GeometryPanel />);
        expect(screen.getByText(/Awaiting data/i)).toBeDefined();
    });

    it('shows insufficient data message when geometry has null fields', () => {
        useLiveStore.setState({
            geometry: {
                curvature: null, imbalance: null, rotation: null,
                structurePressure: null, rotationPressure: null,
                collapseProb: null, breakoutProb: null,
                geometryRegime: null, microState: null, isStable: false,
            },
        });
        render(<GeometryPanel />);
        expect(screen.getByText(/Insufficient data/i)).toBeDefined();
    });

    it('renders geometry values when data is present', () => {
        useLiveStore.setState({
            geometry: {
                curvature: 0.3, imbalance: 0.1, rotation: 0.05,
                structurePressure: 0.7, rotationPressure: 0.05,
                collapseProb: 0.2, breakoutProb: 0.4,
                geometryRegime: 'STABLE_STRUCTURE', microState: 'neutral-stable', isStable: true,
            },
        });
        render(<GeometryPanel />);
        expect(screen.getByText('STABLE_STRUCTURE')).toBeDefined();
    });
});

