import React, { useState } from 'react';
import {
  CreditCard, Phone, ArrowRight, UserPlus,
  AlertCircle, Loader2, CheckCircle2, Sparkles,
  ScanLine, ImageUp, PenLine, ChevronDown, Stethoscope,
  ShieldCheck, Info, PhoneCall
} from 'lucide-react';
import { Citizen } from '../types';
import { validateCCCD } from '../utils/cccdValidator';
import { HeaderInfoBanner } from './HeaderInfoBanner';

interface HeroLoginCardProps {
  onOpenQR: () => void;
  onOpenAIUpload: () => void;
  onLoginSuccess: (citizen: Citizen, isNew: boolean, history?: any[]) => void;
  onOpenLookup?: () => void;
}

export const HeroLoginCard: React.FC<HeroLoginCardProps> = ({
  onOpenQR,
  onOpenAIUpload,
  onLoginSuccess,
  onOpenLookup
}) => {
  const [showManual, setShowManual] = useState(false);
  const [cccdInput, setCccdInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cccdTrimmed = cccdInput.trim();

    const cccdResult = validateCCCD(cccdTrimmed);
    if (!cccdResult.valid) {
      setErrorMsg(cccdResult.errors[0]);
      return;
    }
    if (!phoneInput || !/^\d{10,11}$/.test(phoneInput.trim())) {
      setErrorMsg('Vui lòng nhập số điện thoại (10 - 11 chữ số)');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/citizens/autocreate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cccd: cccdTrimmed, phone: phoneInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi xử lý');
      if (data.success && data.citizen) {
        onLoginSuccess(data.citizen, data.isNew, data.history || []);
      } else {
        throw new Error('Không thể khởi tạo dữ liệu');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleLookupClick = () => {
    if (onOpenLookup) {
      onOpenLookup();
    } else {
      setShowManual(true);
    }
  };

  return (
    <div
      className="w-full max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6"
      style={{
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
      }}
    >
      {/* 1. Top Full-Width Decree Banner */}
      <HeaderInfoBanner
        onOpenQR={onOpenQR}
        onOpenLookup={handleLookupClick}
        showQRButton={false}
      />

      {/* 2. Responsive Grid Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        
        {/* Right Column (7 Cols): Main Entry Actions (Shown FIRST on Mobile for fast scanning) */}
        <div className="lg:col-span-7 order-1 lg:order-2 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden p-4 sm:p-6 space-y-4 sm:space-y-5 animate-fade-in">
          
          {/* Card Header Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 pb-3 sm:pb-3.5 border-b border-slate-100">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-sky-100 flex items-center justify-center text-sky-700 font-bold shrink-0 shadow-sm">
              <Stethoscope className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 leading-tight uppercase text-sm sm:text-lg">
                BẮT ĐẦU KÊ KHAI THÔNG TIN
              </h3>
              <p className="text-slate-500 font-semibold text-[11px] sm:text-sm">
                Chọn 1 trong các hình thức bên dưới để tự động điền thông tin:
              </p>
            </div>
          </div>

          {/* 3 Mobile-Optimized Action Buttons */}
          <div className="space-y-3 sm:space-y-3.5">

            {/* Option 1: QR Camera */}
            <button
              type="button"
              onClick={onOpenQR}
              className="w-full flex items-center gap-3 sm:gap-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97] text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-600/20 transition-all border-0 px-4 sm:px-5 cursor-pointer"
              style={{ minHeight: '68px', touchAction: 'manipulation' }}
            >
              <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/20 flex items-center justify-center border border-white/30">
                <ScanLine className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm sm:text-lg font-black leading-tight truncate">QUÉT MÃ QR CCCD</p>
                <p className="text-[11px] sm:text-xs font-semibold text-emerald-100 leading-tight mt-0.5 truncate">Quét mặt sau thẻ CCCD · Nhanh nhất</p>
              </div>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 opacity-80 flex-shrink-0" />
            </button>

            {/* Option 2: AI Image Upload */}
            <button
              type="button"
              onClick={onOpenAIUpload}
              className="w-full flex items-center gap-3 sm:gap-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 active:scale-[0.97] text-white font-extrabold rounded-2xl shadow-lg shadow-indigo-600/20 transition-all border-0 px-4 sm:px-5 cursor-pointer"
              style={{ minHeight: '68px', touchAction: 'manipulation' }}
            >
              <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/20 flex items-center justify-center border border-white/30">
                <ImageUp className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm sm:text-lg font-black leading-tight">CHỤP ẢNH CCCD</p>
                  <span className="bg-yellow-400 text-slate-900 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-0.5 shrink-0">
                    <Sparkles className="w-2.5 h-2.5" /> AI
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs font-semibold text-indigo-200 leading-tight mt-0.5 truncate">Mặt trước + mặt sau · AI tự động trích xuất</p>
              </div>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 opacity-80 flex-shrink-0" />
            </button>

            {/* Option 3: Manual Entry */}
            <button
              type="button"
              onClick={() => setShowManual(!showManual)}
              className="w-full flex items-center gap-3 sm:gap-4 bg-slate-50 hover:bg-slate-100 active:scale-[0.97] text-slate-800 font-extrabold rounded-2xl border-2 border-slate-200 hover:border-slate-300 transition-all px-4 sm:px-5 cursor-pointer"
              style={{ minHeight: '68px', touchAction: 'manipulation' }}
            >
              <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white flex items-center justify-center border border-slate-200 shadow-sm">
                <PenLine className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm sm:text-lg font-black leading-tight text-slate-800 truncate">NHẬP TAY THỦ CÔNG</p>
                <p className="text-[11px] sm:text-xs font-semibold text-slate-500 leading-tight mt-0.5 truncate">Tự gõ số CCCD + Số điện thoại</p>
              </div>
              <ChevronDown
                className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 flex-shrink-0 transition-transform duration-200"
                style={{ transform: showManual ? 'rotate(180deg)' : 'none' }}
              />
            </button>

            {/* Manual Form (collapsible) */}
            {showManual && (
              <form onSubmit={handleSubmit} className="mt-2 space-y-3.5 animate-fade-in bg-slate-50 border-2 border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-inner">
                {errorMsg && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 font-bold text-xs">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-800 mb-1 text-xs sm:text-sm">
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-sky-600" />
                      Số CCCD / Định danh cá nhân <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={cccdInput}
                    onChange={(e) => setCccdInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="Nhập đúng 12 chữ số CCCD"
                    className="senior-input font-mono tracking-wider text-sm"
                    maxLength={12}
                    autoComplete="off"
                  />
                  {cccdInput.length === 12 && (() => {
                    const r = validateCCCD(cccdInput);
                    return r.valid ? (
                      <p className="mt-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        {r.provinceName} · {r.gender} · Năm sinh {r.birthYear}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        {r.errors[0]}
                      </p>
                    );
                  })()}
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1 text-xs sm:text-sm">
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-4 h-4 text-sky-600" />
                      Số điện thoại liên hệ <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="Nhập 10–11 số điện thoại"
                    className="senior-input font-mono tracking-wider text-sm"
                    maxLength={11}
                    autoComplete="tel"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="senior-btn-primary py-3 sm:py-3.5 text-sm sm:text-base font-black"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Đang kiểm tra dữ liệu...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      <span>BẮT ĐẦU NHẬP PHIẾU</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

        </div>

        {/* Left Column (5 Cols): Guidance & Security Notice Card (Shown SECOND on Mobile) */}
        <div className="lg:col-span-5 order-2 lg:order-1 bg-white rounded-2xl sm:rounded-3xl border border-sky-200/90 shadow-xl overflow-hidden animate-fade-in flex flex-col h-full">
          <div className="bg-gradient-to-r from-sky-700 via-sky-800 to-blue-800 text-white px-4 sm:px-5 py-3.5 flex items-center justify-between shadow-sm">
            <h3 className="font-black tracking-wide text-xs sm:text-base uppercase flex items-center gap-2">
              <span>📋</span> PHIẾU THÔNG TIN KSK 2026
            </h3>
          </div>

          <div className="p-4 sm:p-5 space-y-3.5 text-xs sm:text-sm text-slate-700 leading-relaxed flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 bg-sky-50/80 p-3 rounded-2xl border border-sky-100">
                <ShieldCheck className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 font-bold">Bảo mật thông tin:</strong> Mọi dữ liệu Quý Ông/Bà cung cấp được bảo mật và chỉ sử dụng phục vụ lập hồ sơ KSK 2026.
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-amber-50/80 p-3 rounded-2xl border border-amber-100">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  Vui lòng cung cấp thông tin <strong className="text-slate-900 font-bold">đầy đủ, chính xác</strong> để thuận tiện cho việc tiếp nhận &amp; xử lý hồ sơ.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 bg-emerald-50/80 p-3 rounded-2xl border border-emerald-100 mt-2">
              <PhoneCall className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-900 text-xs">Cần hỗ trợ kê khai thông tin?</p>
                <p className="text-slate-700 text-xs">Vui lòng liên hệ <strong className="text-emerald-800">Trạm Y tế xã Tân An Hội</strong>:</p>
                <p className="mt-1 text-emerald-800 font-black text-xs sm:text-sm">
                  (028) 3795 7845 – (028) 3795 8218
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default HeroLoginCard;
