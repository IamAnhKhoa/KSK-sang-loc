import React, { useState } from 'react';
import { Search, X, UserCheck, AlertCircle, Loader2 } from 'lucide-react';
import { Citizen } from '../types';

interface LookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCitizen: (citizen: Citizen, history?: any[]) => void;
}

export const LookupModal: React.FC<LookupModalProps> = ({
  isOpen,
  onClose,
  onSelectCitizen
}) => {
  const [cccdInput, setCccdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cccdInput || cccdInput.trim().length < 9) {
      setErrorMsg('Vui lòng nhập số CCCD hoặc Mã số định danh (tối thiểu 9 số)');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setNotFound(false);

    try {
      const res = await fetch(`/api/citizens/lookup?cccd=${encodeURIComponent(cccdInput.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Lỗi tra cứu hồ sơ');
      }

      if (data.found && data.citizen) {
        onSelectCitizen(data.citizen, data.history || []);
        onClose();
      } else {
        setNotFound(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Search className="w-6 h-6 text-sky-400" />
            <h3 className="font-extrabold text-xl">TRA CỨU HỒ SƠ CŨ</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSearch} className="p-6 space-y-4">
          <div>
            <label className="senior-label">Nhập số CCCD / Mã định danh</label>
            <input
              type="text"
              value={cccdInput}
              onChange={(e) => setCccdInput(e.target.value)}
              placeholder="VD: 079201012345"
              className="senior-input"
              maxLength={12}
              autoFocus
            />
          </div>

          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700 text-sm font-medium">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {notFound && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm font-medium">
              Chưa có dữ liệu cho CCCD này. Bạn có thể tiến hành nhập mới!
            </div>
          )}

          <div className="pt-2 flex flex-col gap-3">
            <button
              type="submit"
              disabled={loading}
              className="senior-btn-primary py-3.5 text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Đang tìm kiếm...</span>
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  <span>Tìm hồ sơ</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="senior-btn-secondary py-3.5 text-base"
            >
              Hủy bỏ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
