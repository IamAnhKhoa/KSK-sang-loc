import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { X, AlertCircle, Upload, Loader2, CheckCircle2, Zap, Flashlight } from 'lucide-react';
import { parseVietnameseCCCD, ParsedCCCD } from '../utils/qrParser';
import { decodeQrFromFile } from '../utils/multiQrScanner';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (parsedData: ParsedCCCD) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaTrackRef = useRef<MediaStreamTrack | null>(null);
  const frameLoopRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);

  const stopCamera = useCallback(() => {
    stoppedRef.current = true;
    if (frameLoopRef.current) {
      cancelAnimationFrame(frameLoopRef.current);
      frameLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    mediaTrackRef.current = null;
    setIsScanning(false);
    setTorchOn(false);
  }, []);

  const handleQrFound = useCallback((text: string) => {
    if (stoppedRef.current) return;
    const parsed = parseVietnameseCCCD(text);
    if (parsed) {
      stoppedRef.current = true;
      setSuccessToast(`Đã quét thành công: ${parsed.full_name || parsed.cccd}`);
      if (navigator.vibrate) {
        try { navigator.vibrate(100); } catch (_) {}
      }
      stopCamera();
      setTimeout(() => {
        onScanSuccess(parsed);
        onClose();
      }, 300);
    }
  }, [stopCamera, onScanSuccess, onClose]);

  const startFrameScan = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Check for native BarcodeDetector API (iOS 17+, Android Chrome / WebView)
    let nativeDetector: any = null;
    if ('BarcodeDetector' in window) {
      try {
        nativeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) {
        console.warn('BarcodeDetector init error:', e);
      }
    }

    let lastScanTime = 0;
    const SCAN_INTERVAL_MS = 50; // Scan 20 times per second for instant response ("cực nhạy")

    const scan = async (time: number) => {
      if (stoppedRef.current) return;

      if (time - lastScanTime >= SCAN_INTERVAL_MS) {
        lastScanTime = time;

        if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
          // 1. Try Native BarcodeDetector (Hardware Accelerated, Ultra-Fast & Ultra-Sensitive)
          if (nativeDetector) {
            try {
              const barcodes = await nativeDetector.detect(video);
              if (barcodes.length > 0 && barcodes[0]?.rawValue?.trim()) {
                handleQrFound(barcodes[0].rawValue.trim());
                return;
              }
            } catch (_) {}
          }

          // 2. High-precision jsQR fallback
          const vw = video.videoWidth;
          const vh = video.videoHeight;

          // Keep high resolution (max 1280px) to preserve dense CCCD QR code dots
          const scale = Math.min(1, 1280 / vw);
          const targetW = Math.round(vw * scale);
          const targetH = Math.round(vh * scale);

          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
          }
          ctx.drawImage(video, 0, 0, targetW, targetH);

          // Full frame scan with attemptBoth for maximum sensitivity
          const imageData = ctx.getImageData(0, 0, targetW, targetH);
          const result = jsQR(imageData.data, targetW, targetH, { inversionAttempts: 'attemptBoth' });
          if (result?.data?.trim()) {
            handleQrFound(result.data.trim());
            return;
          }
        }
      }
      frameLoopRef.current = requestAnimationFrame(scan);
    };

    frameLoopRef.current = requestAnimationFrame(scan);
  }, [handleQrFound]);

  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg(null);
    setSuccessToast(null);
    setIsScanning(true);
    stoppedRef.current = false;

    const startCamera = async () => {
      const video = videoRef.current;
      if (!video) return;

      // Inline streaming attributes for iOS Safari / Zalo / Android WeChat X5
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('x5-playsinline', 'true');
      video.setAttribute('x5-video-player-type', 'h5-page');
      video.setAttribute('x5-video-player-fullscreen', 'false');
      video.setAttribute('x5-video-orientation', 'portrait');
      video.setAttribute('disablePictureInPicture', 'true');
      video.setAttribute('controlsList', 'nodownload nofullscreen noremoteplayback');
      video.muted = true;
      video.autoplay = true;
      video.controls = false;

      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            }
          });
        } catch (_) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
        }

        if (stoppedRef.current) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        const track = stream.getVideoTracks()[0];
        if (track) {
          mediaTrackRef.current = track;
          try {
            await track.applyConstraints({
              advanced: [{ focusMode: 'continuous' }] as any
            });
          } catch (_) {}
          const caps = track.getCapabilities?.() as any;
          if (caps?.torch) setTorchSupported(true);
        }

        video.srcObject = stream;

        try {
          await video.play();
        } catch (playErr) {
          console.warn('Play video failed:', playErr);
        }

        startFrameScan();

      } catch (err: any) {
        console.error('Camera access error:', err);
        if (!stoppedRef.current) {
          setErrorMsg('Không thể mở camera trên trình duyệt Zalo. Vui lòng bấm "CHỤP ẢNH / TẢI ẢNH CCCD TỪ THƯ VIỆN" bên dưới.');
          setIsScanning(false);
        }
      }
    };

    const timer = setTimeout(startCamera, 150);

    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, [isOpen, startFrameScan, stopCamera]);

  const toggleTorch = async () => {
    if (!mediaTrackRef.current) return;
    try {
      const next = !torchOn;
      await mediaTrackRef.current.applyConstraints({
        advanced: [{ torch: next }] as any
      });
      setTorchOn(next);
    } catch (err) {
      console.error('Torch error:', err);
    }
  };

  const handleCloseModal = () => {
    stopCamera();
    onClose();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setErrorMsg(null);
    setSuccessToast(null);

    try {
      const decodedText = await decodeQrFromFile(file);
      if (decodedText) {
        const parsed = parseVietnameseCCCD(decodedText);
        if (parsed) {
          setSuccessToast(`Đã giải mã thành công: ${parsed.full_name || parsed.cccd}`);
          stopCamera();
          setTimeout(() => {
            onScanSuccess(parsed);
            onClose();
          }, 300);
          return;
        }
      }
      setErrorMsg('Không đọc được mã QR từ ảnh. Vui lòng kiểm tra lại góc chụp hoặc chọn ảnh rõ nét hơn.');
    } catch (err: any) {
      console.error('File scan error:', err);
      setErrorMsg('Lỗi xử lý file ảnh. Vui lòng thử chọn ảnh rõ nét hơn.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/85 backdrop-blur-md animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Zap className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg sm:text-xl leading-tight">QUÉT MÃ QR CCCD TỐC ĐỘ CAO</h3>
              <p className="text-xs text-emerald-300 font-medium">Đưa mã QR trên thẻ CCCD vào khung camera</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {torchSupported && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                  torchOn
                    ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-md'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <Flashlight className="w-4 h-4" />
                <span className="hidden sm:inline">{torchOn ? 'TẮT ĐÈN' : 'BẬT ĐÈN'}</span>
              </button>
            )}
            <button
              onClick={handleCloseModal}
              className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4">
          {successToast && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center gap-3 text-emerald-800 font-extrabold text-base shadow-md">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
              <span>{successToast}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 font-semibold text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Viewport Container with Inline Video */}
          <div className="relative rounded-3xl overflow-hidden border-4 border-emerald-500/50 bg-black aspect-square shadow-2xl">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
              controls={false}
              disablePictureInPicture
              controlsList="nodownload nofullscreen noremoteplayback"
              style={{
                pointerEvents: 'none',
                userSelect: 'none',
                WebkitTransform: 'translateZ(0)'
              }}
            />

            <canvas ref={canvasRef} className="hidden" />

            {/* Viewfinder overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[260px] h-[260px] border-2 border-emerald-400/80 rounded-3xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                {/* Laser */}
                <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#34d399] animate-[scan_2s_infinite]" />
                {/* Corners */}
                <div className="absolute -top-1 -left-1 w-7 h-7 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-7 h-7 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-7 h-7 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-7 h-7 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
                {/* QR target hint */}
                <div className="absolute top-2 right-2 w-24 h-24 border border-dashed border-amber-300/80 rounded-xl flex items-center justify-center bg-amber-400/10">
                  <span className="text-[10px] font-extrabold text-amber-300 uppercase tracking-tighter text-center">
                    Mã QR CCCD
                  </span>
                </div>
              </div>
            </div>

            {/* Status indicator */}
            {isScanning && !errorMsg && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/70 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Đang quét...
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col gap-3">
            <label className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base py-3.5 px-4 rounded-2xl shadow-lg shadow-emerald-600/30 cursor-pointer transition-all flex items-center justify-center gap-2 active:scale-95">
              {isProcessingFile ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
              <span>{isProcessingFile ? 'Đang đọc QR từ ảnh...' : 'CHỤP ẢNH / TẢI ẢNH CCCD TỪ THƯ VIỆN'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={isProcessingFile}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={handleCloseModal}
              className="senior-btn-secondary py-3 text-base"
            >
              Đóng camera / Nhập tay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
