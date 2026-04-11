import React from 'react';
import { LiveAnalysisPage } from './pages/LiveAnalysisPage.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';

export function App(): React.ReactElement {
  return (
    <ErrorBoundary>
      <LiveAnalysisPage />
    </ErrorBoundary>
  );
}
