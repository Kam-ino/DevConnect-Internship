import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/bodoni-moda';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './styles.css';
import App from './App.tsx';

// Last line of defence: a rendering bug shows a plain message instead of a blank page.
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? (
      <p className="crash" role="alert">Something went wrong on this page. Reload it to try again.</p>
    ) : (
      this.props.children
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
