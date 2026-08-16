import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-xl mx-auto my-12 p-8 bg-white border-2 border-red-200 rounded-3xl shadow-xl text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 uppercase">
            ĐÃ XẢY RA LỖI HIỂN THỊ
          </h3>
          <p className="text-slate-600 text-sm font-medium">
            Rất tiếc, đã có sự cố giao diện khi tải dữ liệu báo cáo:
          </p>
          <div className="p-3 bg-red-50 text-red-800 font-mono text-xs rounded-xl overflow-x-auto text-left border border-red-200">
            {this.state.error?.toString() || 'Lỗi không xác định'}
          </div>
          <button
            onClick={() => {
              sessionStorage.clear();
              window.location.reload();
            }}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-3 rounded-2xl flex items-center gap-2 mx-auto shadow-lg transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Tải Lại Trang Quản Trị</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
