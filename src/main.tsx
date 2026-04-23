import React, { StrictMode } from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';

// Simple Error Boundary for tracking crashes
class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error('CRITICAL APP ERROR:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#ba1a1a', fontFamily: 'sans-serif' }}>
          <h2 style={{ marginBottom: '10px' }}>Something went wrong.</h2>
          <p style={{ marginBottom: '20px', color: '#666' }}>{this.state.error?.toString()}</p>
          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ padding: '10px 20px', background: '#003399', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Clear Data & Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('Service Worker registration failed: ', err);
    });
  });
}
