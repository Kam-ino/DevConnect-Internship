import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/hanken-grotesk';
import '@fontsource-variable/azeret-mono';
import './styles.css';
import App from './App.tsx';

// A rendering bug shows a message with a way out instead of a blank page.
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="notice">
        <h1>Something broke on this page</h1>
        <p>Stillroom hit an unexpected error while drawing this screen. Your videos and kept frames are safe.</p>
        <button className="button button-chalk" type="button" onClick={() => location.assign('/')}>Back to the library</button>
      </main>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </ErrorBoundary>
  </StrictMode>,
);
