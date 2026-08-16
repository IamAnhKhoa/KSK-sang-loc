import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { HeroLoginCard } from './components/HeroLoginCard';
import { CitizenForm } from './components/CitizenForm';
import { AdminDashboard } from './components/AdminDashboard';
import { QRScannerModal } from './components/QRScannerModal';
import { CCCDImageUploadModal } from './components/CCCDImageUploadModal';
import { LookupModal } from './components/LookupModal';
import { ParsedCCCD } from './utils/qrParser';
import { Citizen, FormDataState } from './types';
import { UserCheck, LogOut, Code2, X, CheckCircle2, Globe, Phone } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'form' | 'admin'>(() => {
    if (window.location.pathname.startsWith('/manage') || window.location.search.includes('manage')) {
      return 'admin';
    }
    return 'form';
  });

  const [isQROpen, setIsQROpen] = useState(false);
  const [isAIUploadOpen, setIsAIUploadOpen] = useState(false);
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [isDevPopupOpen, setIsDevPopupOpen] = useState(false);
  const [activeCitizen, setActiveCitizen] = useState<Citizen | null>(null);
  const [scannedData, setScannedData] = useState<Partial<FormDataState> | null>(null);

  const handleTabChange = (tab: 'form' | 'admin') => {
    setActiveTab(tab);
    if (tab === 'admin') {
      window.history.pushState({}, '', '/manage');
    } else {
      window.history.pushState({}, '', '/');
    }
  };

  // Helper to extract latest record fields
  const getLatestRecordFields = (history?: any[]) => {
    if (!Array.isArray(history) || history.length === 0) return {};
    const rec = history[0];
    let screeningDetails: string[] = [];
    if (rec.screening_details) {
      try {
        screeningDetails = typeof rec.screening_details === 'string'
          ? JSON.parse(rec.screening_details)
          : rec.screening_details;
      } catch (_) {}
    }
    return {
      exam_type: rec.exam_type || 'Khám sức khỏe tổng quát',
      screening_details: screeningDetails,
      screening_other: rec.screening_other || '',
      exam_date: rec.exam_date || '',
      exam_location: rec.exam_location || 'Trạm Y Tế Xã Tân An Hội',
      exam_result: rec.exam_result || '',
      attachment_id: rec.attachment_id || ''
    };
  };

  // Handle QR/AI Scan Success: Auto-create account in DB + Auto-fill Form
  const handleScanSuccess = async (parsed: ParsedCCCD) => {
    const rawAddr = parsed.address || '';
    const converted = convertOldAddressToNew(rawAddr);

    const fallbackData = {
      cccd: parsed.cccd,
      full_name: parsed.full_name || '',
      dob: parsed.dob || '',
      gender: parsed.gender || 'Nam',
      current_address: converted.current_address || rawAddr,
      ward: converted.ward || 'Xã Tân An Hội',
      old_address_note: converted.old_address_note || ''
    };

    setScannedData(fallbackData);

    // Create active citizen locally immediately
    const tempCitizen: Citizen = {
      id: Date.now(),
      ...fallbackData,
      ethnicity: 'Kinh',
      category: 'Người lao động phi chính thức'
    };
    setActiveCitizen(tempCitizen);

    // Sync to backend DB asynchronously
    try {
      const res = await fetch('/api/citizens/autocreate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fallbackData)
      });
      const data = await res.json();
      if (data.success && data.citizen) {
        setActiveCitizen(data.citizen);
        const latestRec = getLatestRecordFields(data.history);
        setScannedData({
          ...fallbackData,
          ...data.citizen,
          ...latestRec
        });
      }
    } catch (err) {
      console.error('Backend sync error:', err);
    }
  };

  const handleLoginSuccess = (citizen: Citizen, isNew: boolean, history?: any[]) => {
    setActiveCitizen(citizen);
    const latestRec = getLatestRecordFields(history);
    setScannedData({
      cccd: citizen.cccd,
      full_name: citizen.full_name || '',
      dob: citizen.dob || '',
      gender: citizen.gender || 'Nam',
      ethnicity: citizen.ethnicity || 'Kinh',
      blood_type: citizen.blood_type || '',
      bhyt: citizen.bhyt || '',
      current_address: citizen.current_address || '',
      ward: citizen.ward || 'Xã Tân An Hội',
      old_address_note: citizen.old_address_note || '',
      job: citizen.job || '',
      workplace: citizen.workplace || 'Xã Tân An Hội',
      guardian_name: citizen.guardian_name || '',
      phone: citizen.phone || '',
      category: citizen.category || '',
      ...latestRec
    });
  };

  const handleLogout = () => {
    setActiveCitizen(null);
    setScannedData(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onOpenQR={() => setIsQROpen(true)}
      />

      {/* Logged in User Bar */}
      {activeCitizen && activeTab === 'form' && (
        <div className="bg-sky-900 text-white py-2.5 px-4 animate-fade-in">
          <div className="max-w-4xl mx-auto flex items-center justify-between text-sm font-semibold">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-400" />
              <span>
                Đang tự động nhập phiếu cho: <strong className="text-emerald-300 uppercase">{activeCitizen.full_name || activeCitizen.cccd}</strong> (CCCD: {activeCitizen.cccd})
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 bg-sky-800 hover:bg-sky-700 px-3 py-1 rounded-lg text-xs transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Đổi CCCD khác</span>
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col justify-center">
        <ErrorBoundary>
          {activeTab === 'admin' ? (
            <AdminDashboard />
          ) : !activeCitizen && !scannedData ? (
            <HeroLoginCard
              onOpenQR={() => setIsQROpen(true)}
              onOpenAIUpload={() => setIsAIUploadOpen(true)}
              onLoginSuccess={handleLoginSuccess}
              onOpenLookup={() => setIsLookupOpen(true)}
            />
          ) : (
            <CitizenForm
              onOpenQR={() => setIsQROpen(true)}
              onOpenLookup={() => setIsLookupOpen(true)}
              scannedData={scannedData}
              clearScannedData={() => setScannedData(null)}
              onNewRecord={() => { handleLogout(); setIsQROpen(true); }}
            />
          )}
        </ErrorBoundary>
      </main>

      {/* QR Scanner Modal */}
      <QRScannerModal
        isOpen={isQROpen}
        onClose={() => setIsQROpen(false)}
        onScanSuccess={handleScanSuccess}
      />

      {/* AI Image Upload Modal */}
      <CCCDImageUploadModal
        isOpen={isAIUploadOpen}
        onClose={() => setIsAIUploadOpen(false)}
        onParsed={handleScanSuccess}
      />

      {/* Manual Lookup Modal */}
      <LookupModal
        isOpen={isLookupOpen}
        onClose={() => setIsLookupOpen(false)}
        onSelectCitizen={(citizen, history) => {
          setActiveCitizen(citizen);
          handleLoginSuccess(citizen, false, history);
        }}
      />

      {/* Footer — compact copyright bar */}
      <footer className="bg-slate-900 border-t border-slate-800 mt-auto">
        <button
          type="button"
          onClick={() => setIsDevPopupOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-slate-500 hover:text-slate-300 transition-colors group"
        >
          <Code2 className="w-3.5 h-3.5 text-sky-600 group-hover:text-sky-400 transition-colors flex-shrink-0" />
          <span className="text-[11px] font-semibold tracking-wide">© Developer by Anh Khoa</span>
        </button>
      </footer>

      {/* Developer Contact Popup */}
      {isDevPopupOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsDevPopupOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-slate-700 animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-sky-600 text-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider">💬 Liên hệ thiết kế &amp; phát triển</span>
              <button onClick={() => setIsDevPopupOpen(false)} className="p-1 rounded-full hover:bg-sky-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-white px-5 py-4 space-y-3.5">
              <div className="flex flex-col items-center text-center gap-2 pt-1">
                <div className="w-14 h-14 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-2xl shadow-sm">👨‍💻</div>
                <div>
                  <p className="font-extrabold text-slate-900 text-sm">Developer Anh Khoa</p>
                  <p className="text-slate-500 text-xs mt-0.5">Tư vấn &amp; Thiết kế giải pháp Phần mềm, Web App chuyên nghiệp</p>
                </div>
              </div>
              <div className="space-y-1.5 bg-slate-50 rounded-2xl p-3">
                {['Hệ thống Quản lý Y tế, Trường học, Doanh nghiệp', 'Số hóa quy trình, tích hợp Google Sheets API, Cloud Data', 'Giao diện hiện đại, tối ưu tốc độ & trải nghiệm người dùng'].map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <a href="https://zalo.me/0332185388" target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 rounded-xl text-sm transition-all active:scale-[0.98] shadow-md">
                  💬 Nhắn Zalo: 0332.185.388
                </a>
                <a href="https://portfolio.tak.id.vn/" target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full border-2 border-sky-500 text-sky-600 hover:bg-sky-50 font-bold py-2.5 rounded-xl text-sm transition-all active:scale-[0.98]">
                  <Globe className="w-3.5 h-3.5" />
                  Xem Hồ sơ năng lực (Portfolio)
                </a>
              </div>
              <p className="text-center text-slate-400 text-xs flex items-center justify-center gap-1.5 pb-1">
                <Phone className="w-3 h-3" />
                Hotline / Zalo: <strong className="text-slate-600">0332.185.388</strong>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
