// Unit tests for AlertsPanel
// Requirements: 27.4

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom'; // Fix for toBeInTheDocument type error
import React from 'react';
import { AlertsPanel } from './AlertsPanel.js';
import { useLiveStore } from '../state/liveStore.js';
import type { GeometryOutput } from '../types/index.js';

describe('AlertsPanel', () => {
    beforeEach(() => {
        // Reset store to a clean state before each test
        act(() => {
            useLiveStore.setState({
                alerts: [],
                isStale: false,
                isReplayMode: false,
                state: { 
                    state: 'IDLE', 
                    previousState: null,
                    timestamp: new Date().toISOString(),
                    reason: 'System initialized',
                    cooldownRemaining: 0,
                    alignmentScore: 0
                },
                risk: { 
                    hardReject: false, 
                    rejectReasons: [], 
                    probability: 0,
                    edd: 0,
                    stopDistance: 0,
                    targetDistance: 0,
                    ev: 0,
                    volatilityRegime: 'NORMAL',
                    globalStress: 'SAFE',
                    geometryStable: true,
                    microstructureComplete: false
                }
            });
        });
    });

    it('shows no active alerts message when empty', async () => {
        render(<AlertsPanel />);
        expect(await screen.findByText(/System Monitor Clear/i)).toBeInTheDocument();
    });

    it('renders system status correctly', async () => {
        act(() => {
            useLiveStore.setState({
                geometry: { 
                    geometryRegime: 'STABLE_STRUCTURE',
                    curvature: null,
                    imbalance: null,
                    rotation: null,
                    structurePressure: null,
                    rotationPressure: null,
                    collapseProb: null,
                    breakoutProb: null,
                    microState: null,
                    isStable: true
                } as GeometryOutput,
                state: { 
                    state: 'COOLDOWN', 
                    previousState: 'IDLE',
                    timestamp: new Date().toISOString(),
                    reason: 'Ready',
                    cooldownRemaining: 30,
                    alignmentScore: 0.5
                }
            });
        });

        render(<AlertsPanel />);
        expect(await screen.findByText(/Ready/i)).toBeInTheDocument();
        expect(screen.getByText(/COOLDOWN/i)).toBeInTheDocument();
    });

    it('displays ACTIVE status when state machine is ACTIVE', async () => {
        act(() => {
            useLiveStore.setState({
                state: { 
                    state: 'IN_TRADE', 
                    previousState: 'WAITING_FOR_RETEST',
                    timestamp: new Date().toISOString(),
                    reason: 'High alignment',
                    cooldownRemaining: 0,
                    alignmentScore: 0.95
                }
            });
        });

        render(<AlertsPanel />);
        expect(await screen.findByText(/HIGH ALIGNMENT/i)).toBeInTheDocument();
    });

    it('shows stale data indicator when isStale is true', async () => {
        act(() => { useLiveStore.setState({ isStale: true }); });
        render(<AlertsPanel />);
        expect(await screen.findByText(/API Connection Lost/i)).toBeInTheDocument();
    });

    it('shows replay mode indicator when isReplayMode is true', async () => {
        act(() => { useLiveStore.setState({ isReplayMode: true }); });
        render(<AlertsPanel />);
        expect(await screen.findByText(/REPLAY ACTIVE/i)).toBeInTheDocument();
    });

    it('renders new alerts immediately on store update', async () => {
        render(<AlertsPanel />);
        
        await act(async () => {
            useLiveStore.setState({
                alerts: [{
                    id: '1',
                    message: 'Sweep detected',
                    severity: 'info',
                    timestamp: new Date().toISOString(),
                    expiresAt: Date.now() + 30_000,
                }]
            });
        });

        expect(await screen.findByText(/Sweep detected/i)).toBeInTheDocument();
    });
});
