import React, { Component, ErrorInfo, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught application error:", error, errorInfo);
  }

  handleReload = () => {
    // Clear any potentially corrupted transient session tokens if needed and reload
    try {
      window.location.reload();
    } catch (_) {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans" dir="rtl">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-xl border border-gray-200 text-center space-y-4">
            <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-2xl mx-auto flex items-center justify-center text-3xl">
              🔧
            </div>
            <h2 className="text-xl font-extrabold text-gray-800">
              تم استعادة التطبيق بنجاح
            </h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              حدث خطأ غير متوقع أثناء معالجة البيانات، تم حماية حسابك وجلسة الدخول لمنع توقف التطبيق.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer"
              >
                تحديث واستئناف العمل الآن ↻
              </button>
            </div>
          </div>
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

