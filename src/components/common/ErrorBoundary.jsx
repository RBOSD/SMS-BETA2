/**
 * React Error Boundary - 捕獲子元件錯誤，避免整個應用崩潰
 */
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      if (typeof fallback === 'function') return fallback(this.state.error);
      if (fallback) return fallback;
      return (
        <div
          style={{
            padding: 24,
            margin: 16,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            color: '#991b1b',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>發生錯誤</div>
          <div style={{ fontSize: 13, marginBottom: 12 }}>{this.state.error?.message || '未知錯誤'}</div>
          <button
            className="btn btn-outline"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            重試
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
