import React from 'react';

interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren<Record<string, unknown>>, ErrorBoundaryState> {
    constructor(props: React.PropsWithChildren<Record<string, unknown>>) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo): void {
        console.error('Unhandled UI error:', error, info);
    }

    render(): React.ReactNode {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px',
                    background: '#000',
                    color: '#fff',
                    textAlign: 'center',
                }}>
                    <div>
                        <h1 style={{ marginBottom: '16px', fontSize: '28px' }}>Something went wrong</h1>
                        <p style={{ marginBottom: '8px', color: '#ccc' }}>
                            An unexpected error occurred while rendering the dashboard.
                        </p>
                        <p style={{ marginBottom: 0, color: '#999' }}>
                            Please refresh the page or contact support if the issue persists.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
