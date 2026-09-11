import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
    if (window.Sentry) window.Sentry.captureException(error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4 text-2xl">!</div>
          <h2 className="text-xl font-bold text-gray-900">Something went wrong</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-md">An unexpected error occurred. Please refresh the page or contact support if the problem persists.</p>
          <pre className="mt-4 text-xs text-gray-400 max-w-full overflow-auto p-3 bg-gray-50 rounded-lg hidden sm:block">{String(this.state.error?.message || '').slice(0, 300)}</pre>
          <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 rounded-xl bg-navy-900 text-white text-sm font-medium hover:bg-black">Reload page</button>
        </div>
      );
    }
    return this.props.children;
  }
}
