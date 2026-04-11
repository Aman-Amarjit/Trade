// Unit tests for AlertsPanel
// Requirements: 27.4

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { AlertsPanel } from './AlertsPanel.js';
import { useLiveStore } from '../state/liveStore';

describe('AlertsPanel', () => {
    beforeEach(() => {
        useLiveStore.setState({ alerts: [], isStale: false, isReplayMode: false, state: null, risk: null });
    });

    it('shows no active alerts message when empty', () => {
        render(<AlertsPanel />);
        expect(screen.getByText(/System Monitor Clear/i)).toBeDefined();
    });

    it('renders new alerts immediately on store update without page refresh', () => {
        const { rerender } = render(<AlertsPanel />);

        act(() => {
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

        rerender(<AlertsPanel />);
        expect(screen.getAllByText(/Sweep detected/i).length).toBeGreaterThan(0);
    });

    it('shows stale data indicator when isStale is true', () => {
        act(() => { useLiveStore.setState({ isStale: true }); });
        render(<AlertsPanel />);
        expect(screen.getByText(/API Connection Lost/i)).toBeDefined();
    });

    it('shows replay mode indicator when isReplayMode is true', () => {
        act(() => { useLiveStore.setState({ isReplayMode: true }); });
        render(<AlertsPanel />);
        expect(screen.getByText(/REPLAY ACTIVE/i)).toBeDefined();
    });
});

