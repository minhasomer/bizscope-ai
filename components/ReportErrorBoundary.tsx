import React from 'react';

interface ReportErrorBoundaryProps {
  children: React.ReactNode;
  onNavigate?: (page: any) => void;
}

interface ReportErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render-time errors thrown while displaying a report (e.g. a
 * malformed report missing a required field) so a single bad report can't
 * blank-screen the whole app. Resets automatically if the user navigates
 * away and back to a report (new key from the parent), or via the button.
 */
export class ReportErrorBoundary extends React.Component<ReportErrorBoundaryProps, ReportErrorBoundaryState> {
  state: ReportErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ReportErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string }) {
    console.error('[ReportErrorBoundary] Report render failed:', error, info.componentStack);
  }

  render() {
    const self = this as React.Component<ReportErrorBoundaryProps, ReportErrorBoundaryState>;
    if (self.state.hasError) {
      return (
        <div className="max-w-xl mx-auto py-16 px-4 text-center min-h-[50vh] flex flex-col items-center justify-center gap-4">
          <p className="text-gray-700 text-sm font-semibold">This report couldn't be displayed.</p>
          <p className="text-gray-500 text-xs">The report data appears to be incomplete or malformed. Try regenerating it.</p>
          <button
            onClick={() => { self.setState({ hasError: false }); self.props.onNavigate?.('home'); }}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
          >
            Go to Home
          </button>
        </div>
      );
    }
    return self.props.children;
  }
}
