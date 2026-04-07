'use client';

import React from 'react';

interface Props {
  label?: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class CanvasErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[CanvasErrorBoundary] ${this.props.label ?? 'Element'} crashed:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      const label = this.props.label ?? 'Element';
      return (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <span className="font-medium">{label} failed to render.</span>
          <button
            type="button"
            className="ml-2 underline hover:text-red-900 focus-visible:outline-none"
            onClick={() => this.setState({ hasError: false })}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
