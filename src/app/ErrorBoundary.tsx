import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// React only supports catching render-time errors via a class component's
// getDerivedStateFromError/componentDidCatch — there is no hooks equivalent.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erreur non gérée dans l\'application :', error, info.componentStack);
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-white p-4">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Une erreur est survenue</h1>
          <p className="text-sm text-gray-600 mb-6">
            L'application a rencontré un problème inattendu. Recharger la page devrait résoudre le souci.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
          >
            Recharger la page
          </button>
        </div>
      </div>
    );
  }
}
