import React from 'react';
import { QrCode, Search } from 'lucide-react';

interface HeaderInfoBannerProps {
  onOpenQR?: () => void;
  onOpenLookup?: () => void;
  showQRButton?: boolean;
}

export const HeaderInfoBanner: React.FC<HeaderInfoBannerProps> = ({
  onOpenQR,
  onOpenLookup,
  showQRButton = false
}) => {
  return (
    <div className="w-full animate-fade-in">
      {/* Top Banner Card: Công văn 11292/SYT-NVY */}
      <div className="bg-gradient-to-r from-sky-900 via-sky-800 to-blue-900 rounded-2xl p-3.5 sm:p-5 text-white shadow-lg relative overflow-hidden border border-sky-700/50">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
          
          {/* Banner Text Section */}
          <div className="flex flex-col gap-1 sm:gap-1.5 text-center md:text-left flex-1 w-full">
            <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
              <span className="bg-sky-400/25 text-sky-200 text-[10px] sm:text-xs font-extrabold uppercase tracking-wider px-2 sm:px-2.5 py-0.5 rounded-md border border-sky-400/40">
                Công văn số 11292/SYT-NVY
              </span>
              <h2 className="text-xs sm:text-base md:text-lg font-black tracking-tight leading-snug">
                PHIẾU THU THẬP THÔNG TIN KHÁM SỨC KHỎE / SÀNG LỌC
              </h2>
            </div>
            <p className="text-sky-100 text-[11px] sm:text-sm font-normal leading-normal">
              Quét QR trên thẻ CCCD để tự động điền thông tin nhanh chóng.
            </p>
          </div>

          {/* Right Action Button (Lookup CCCD) */}
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-center md:justify-end">
            {showQRButton && onOpenQR && (
              <button
                type="button"
                onClick={onOpenQR}
                className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-extrabold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 border border-emerald-400/30 cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                <span>QUÉT QR CCCD</span>
              </button>
            )}

            {onOpenLookup && (
              <button
                type="button"
                onClick={onOpenLookup}
                className="w-full md:w-auto bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-white/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
              >
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Tra cứu / Nhập Số CCCD</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
