import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, CheckCircle2, AlertCircle, Loader2, Sparkles, Trash2, ScanSearch, FileSearch, Brain, Zap } from 'lucide-react';
import { decodeQrFromFile } from '../utils/multiQrScanner';
import { parseVietnameseCCCD, ParsedCCCD } from '../utils/qrParser';

interface CCCDImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onParsed: (parsed: ParsedCCCD) => void;
}

type SlotKey = 'front' | 'back';

interface ImageSlot {
  file: File | null;
  preview: string | null;
  base64: string | null;
  mimeType: string;
}

const EMPTY_SLOT: ImageSlot = { file: null, preview: null, base64: null, mimeType: 'image/jpeg' };

const PARSE_STEPS = [
  { icon: ScanSearch,  label: 'Đang nhận diện ảnh CCCD...' },
  { icon: FileSearch,  label: 'Đang đọc số căn cước, họ tên...' },
  { icon: Brain,       label: 'Đang trích xuất ngày sinh, địa chỉ...' },
  { icon: Zap,         label: 'Đang kiểm tra và hoàn thiện dữ liệu...' },
];

// Resize & compress image to max 1200px edge, JPEG 85% — reduces payload from ~4MB to ~200KB
async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
    };
    img.onerror = reject;
    img.src = url;
  });
}

export const CCCDImageUploadModal: React.FC<CCCDImageUploadModalProps> = ({
  isOpen,
  onClose,
  onParsed
}) => {
  const [slots, setSlots] = useState<Record<SlotKey, ImageSlot>>({ front: EMPTY_SLOT, back: EMPTY_SLOT });
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<any | null>(null);

  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate steps while loading
  useEffect(() => {
    if (loading) {
      setCurrentStep(0);
      let idx = 0;
      stepTimerRef.current = setInterval(() => {
        idx = Math.min(idx + 1, PARSE_STEPS.length - 1);
        setCurrentStep(idx);
      }, 900);
    } else {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      stepTimerRef.current = null;
      setCurrentStep(-1);
    }
    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, [loading]);

  const handleFileSelect = async (slotKey: SlotKey, file: File | null) => {
    if (!file) return;
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const preview = URL.createObjectURL(file);
      setSlots(prev => ({ ...prev, [slotKey]: { file, preview, base64, mimeType } }));
      setErrorMsg(null);
      setParsedPreview(null);
    } catch {
      setErrorMsg('Lỗi đọc file ảnh. Vui lòng thử lại.');
    }
  };

  const clearSlot = (slotKey: SlotKey) => {
    const slot = slots[slotKey];
    if (slot.preview) URL.revokeObjectURL(slot.preview);
    setSlots(prev => ({ ...prev, [slotKey]: EMPTY_SLOT }));
    setParsedPreview(null);
  };

  const handleAnalyze = async () => {
    const images = [slots.front, slots.back].filter(s => s.base64);
    if (images.length === 0) {
      setErrorMsg('Vui lòng chọn ít nhất 1 ảnh CCCD (mặt trước hoặc mặt sau)');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    // 1. Primary AI Cloud OCR Text Recognition (with 25s timeout)
    let networkFailed = false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);

      const res = await fetch('/api/ai/parse-cccd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: images.map(s => ({ base64: s.base64!, mimeType: s.mimeType }))
        }),
        signal: controller.signal
      });

      clearTimeout(timer);

      const data = await res.json();

      // Success: got valid CCCD data
      if (res.ok && data.success && data.parsed) {
        setParsedPreview(data.parsed);
        setLoading(false);
        return;
      }

      // API returned an error with specific message — show it directly, do NOT run QR
      if (!res.ok || data.error) {
        setErrorMsg(data.error || `Lỗi máy chủ AI (${res.status}). Vui lòng thử lại.`);
        setLoading(false);
        return;
      }
    } catch (err: any) {
      // Network failure (timeout, offline) — try QR scanner as last resort
      console.warn('AI Cloud OCR network error:', err);
      networkFailed = true;
    }

    // 2. QR scanner fallback ONLY when network/server completely failed (not when AI just couldn't read)
    if (networkFailed) {
      for (const slotKey of ['front', 'back'] as SlotKey[]) {
        const slot = slots[slotKey];
        if (slot.file) {
          try {
            const qrText = await decodeQrFromFile(slot.file);
            if (qrText) {
              const parsed = parseVietnameseCCCD(qrText);
              if (parsed && parsed.cccd && parsed.cccd.length >= 9) {
                setParsedPreview(parsed);
                setLoading(false);
                return;
              }
            }
          } catch (err) {
            console.warn('Fallback scanner exception:', err);
          }
        }
      }
      setErrorMsg('Không kết nối được server AI. Vui lòng kiểm tra mạng và thử lại.');
    }

    setLoading(false);
  };

  const handleConfirm = () => {
    if (!parsedPreview) return;
    const result: ParsedCCCD = {
      cccd: parsedPreview.cccd?.replace(/\D/g, '') || '',
      full_name: (parsedPreview.full_name || '').toUpperCase(),
      dob: parsedPreview.dob || '',
      gender: parsedPreview.gender || 'Nam',
      address: parsedPreview.address || ''
    };
    onParsed(result);
    handleClose();
  };

  const handleClose = () => {
    clearSlot('front');
    clearSlot('back');
    setErrorMsg(null);
    setParsedPreview(null);
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 my-4">

        {/* Header */}
        <div className="bg-gradient-to-r from-violet-700 to-indigo-700 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center border border-white/30">
              <Sparkles className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg leading-tight">CHỤP / TẢI ẢNH CCCD</h3>
              <p className="text-xs text-indigo-200 font-medium">Tự động đọc và điền thông tin</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4">

          {/* Image slots */}
          <div className="grid grid-cols-2 gap-3">
            {(['front', 'back'] as SlotKey[]).map((slotKey) => {
              const slot = slots[slotKey];
              const label = slotKey === 'front' ? 'Mặt TRƯỚC' : 'Mặt SAU';
              const hint = slotKey === 'front' ? 'Họ tên, ngày sinh' : 'Có mã QR';
              const ref = slotKey === 'front' ? frontRef : backRef;

              return (
                <div key={slotKey} className="flex flex-col gap-2">
                  <p className="text-xs font-extrabold text-slate-700 uppercase tracking-wide text-center">{label}</p>
                  {slot.preview ? (
                    <div className="relative rounded-2xl overflow-hidden border-2 border-indigo-400 aspect-[3/2] bg-slate-100">
                      <img src={slot.preview} alt={label} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => clearSlot(slotKey)}
                        className="absolute top-1.5 right-1.5 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50 aspect-[3/2] cursor-pointer transition-all text-center p-2 active:scale-95">
                      <Camera className="w-7 h-7 text-indigo-400" />
                      <span className="text-[11px] font-bold text-slate-500 leading-tight">{hint}</span>
                      <span className="text-[10px] text-indigo-500 font-bold uppercase">Chạm để chọn</span>
                      <input
                        ref={ref}
                        type="file"
                        accept="image/*"
                        onChange={e => handleFileSelect(slotKey, e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-center text-slate-400 font-medium -mt-1">
            Chụp rõ, đủ ánh sáng, không bị che. Có thể tải 1 hoặc cả 2 mặt.
          </p>

          {/* Progress steps while loading */}
          {loading && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-2.5">
              {PARSE_STEPS.map((step, i) => {
                const Icon = step.icon;
                const isDone = i < currentStep;
                const isActive = i === currentStep;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 transition-all duration-300 ${
                      isDone ? 'opacity-40' : isActive ? 'opacity-100' : 'opacity-20'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'
                    }`}>
                      {isDone
                        ? <CheckCircle2 className="w-4 h-4" />
                        : isActive
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Icon className="w-4 h-4" />
                      }
                    </div>
                    <span className={`text-sm font-bold ${isActive ? 'text-indigo-700' : isDone ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Error */}
          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-red-700 font-semibold text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Parsed preview */}
          {parsedPreview && !errorMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 animate-fade-in">
              <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Đọc thông tin thành công
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-sm">
                {[
                  ['Số CCCD', parsedPreview.cccd],
                  ['Họ và tên', parsedPreview.full_name],
                  ['Ngày sinh', parsedPreview.dob],
                  ['Giới tính', parsedPreview.gender],
                ].map(([label, value]) => (
                  <div key={label} className="bg-white rounded-xl p-2 border border-emerald-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{label}</p>
                    <p className="font-extrabold text-slate-800 text-xs truncate">{value || '—'}</p>
                  </div>
                ))}
                {parsedPreview.address && (
                  <div className="col-span-2 bg-white rounded-xl p-2 border border-emerald-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Địa chỉ</p>
                    <p className="font-semibold text-slate-700 text-xs leading-snug">{parsedPreview.address}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-1">
            {parsedPreview ? (
              <button
                type="button"
                onClick={handleConfirm}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-2xl text-base shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                XÁC NHẬN — TỰ ĐỘNG ĐIỀN VÀO PHIẾU
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={loading || (!slots.front.base64 && !slots.back.base64)}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-extrabold py-3.5 rounded-2xl text-base shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang đọc ảnh CCCD...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-yellow-300" />
                    ĐỌC THÔNG TIN TỪ ẢNH
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleClose}
              className="senior-btn-secondary py-3 text-base"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
