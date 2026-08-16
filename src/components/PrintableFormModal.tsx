import React, { useRef, useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { HealthRecord } from '../types';

interface PrintableFormModalProps {
  record: HealthRecord | null;
  onClose: () => void;
}

const formatDateVN = (dateStr?: string): string => {
  if (!dateStr) return '';
  if (dateStr.includes('/')) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return dateStr;
};

export const PrintableFormModal: React.FC<PrintableFormModalProps> = ({ record, onClose }) => {
  if (!record) return null;

  const printRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setDownloading(true);
    try {
      const name = (record.full_name || record.cccd || 'HoSo').replace(/\s+/g, '_');
      const opt = {
        margin: [8, 8, 8, 8],
        filename: `Phieu_KSK_${name}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          scrollY: 0,
          scrollX: 0,
          windowWidth: 794,
          backgroundColor: '#ffffff',
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };
      await html2pdf().set(opt).from(printRef.current).save();
    } catch (err: any) {
      alert('Lỗi tạo PDF: ' + (err?.message || 'Không xác định'));
    } finally {
      setDownloading(false);
    }
  };

  const screeningList = Array.isArray(record.screening_details)
    ? record.screening_details
    : typeof record.screening_details === 'string' && record.screening_details.startsWith('[')
      ? (() => { try { return JSON.parse(record.screening_details!); } catch { return []; } })()
      : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Controls Bar */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <h3 className="font-extrabold text-base flex items-center gap-2">
            <Download className="w-4 h-4 text-sky-400" />
            PHIẾU THU THẬP THÔNG TIN — {record.full_name}
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-all"
            >
              {downloading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Đang tạo PDF...</>
                : <><Download className="w-4 h-4" />Tải PDF về máy</>
              }
            </button>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div
          ref={printRef}
          className="p-8 md:p-12 text-slate-900 font-serif leading-relaxed text-base bg-white"
          id="printable-area"
        >
          {/* Header — 3-column official layout */}
          <div className="flex items-start mb-6 border-b pb-4 gap-2">
            {/* Col 1: Logo alone — top-left */}
            <div className="flex-shrink-0 w-20 flex flex-col items-center">
              <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain" crossOrigin="anonymous" />
            </div>

            {/* Col 2: UBND / TRẠM Y TẾ */}
            <div className="flex-1 text-center font-bold">
              <p className="uppercase text-xs font-bold text-slate-600 leading-tight">ỦY BAN NHÂN DÂN XÃ TÂN AN HỘI</p>
              <p className="text-sm font-extrabold uppercase tracking-wide mt-0.5">TRẠM Y TẾ</p>
              <p className="text-xs font-normal mt-0.5">───────</p>
            </div>

            {/* Col 3: CỘNG HÒA */}
            <div className="flex-1 text-center font-bold">
              <p className="uppercase text-xs font-bold leading-tight">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
              <p className="text-xs mt-0.5">Độc lập - Tự do - Hạnh phúc</p>
              <p className="text-xs font-normal mt-0.5">───────────────</p>
            </div>
          </div>

          {/* Title */}
          <div className="text-center my-6 space-y-1">
            <h2 className="text-xl md:text-2xl font-extrabold uppercase">
              PHIẾU THU THẬP THÔNG TIN NGƯỜI DÂN ĐÃ KHÁM SỨC KHỎE HOẶC KHÁM SÀNG LỌC
            </h2>
            <p className="text-xs italic">
              (Kèm theo Công văn số 11292/SYT-NVY ngày 14 tháng 08 năm 2026 của Sở Y tế)
            </p>
          </div>

          {/* Section I */}
          <div className="space-y-4 my-6">
            <h3 className="font-bold text-lg uppercase border-b border-slate-400 pb-1">
              THÔNG TIN HÀNH CHÍNH
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <strong>Họ và tên:</strong> <span className="uppercase font-bold">{record.full_name}</span>
              </div>
              <div>
                <strong>Giới tính:</strong> [{record.gender === 'Nam' ? 'X' : ' '}] Nam &nbsp;&nbsp;&nbsp; [{record.gender === 'Nữ' ? 'X' : ' '}] Nữ
              </div>
              <div>
                <strong>Ngày tháng năm sinh:</strong> {formatDateVN(record.dob)}
              </div>
              <div>
                <strong>Dân tộc:</strong> {record.ethnicity || 'Kinh'}
              </div>
              <div>
                <strong>Nhóm máu (nếu có):</strong> {record.blood_type || '..............'}
              </div>
              <div>
                <strong>Số CCCD/Mã số định danh:</strong> <span className="font-mono font-bold">{record.cccd}</span>
              </div>
              <div>
                <strong>Số thẻ BHYT:</strong> {record.bhyt || '..............'}
              </div>
              <div>
                <strong>Điện thoại di động:</strong> {record.phone || '..............'}
              </div>
              <div className="col-span-2">
                <strong>Nơi ở hiện tại:</strong> {record.current_address || '................................'} &nbsp;
                <strong>Xã/phường:</strong> {record.ward || 'Tân An Hội'}
              </div>
              <div>
                <strong>Nghề nghiệp:</strong> {record.job || '..............'}
              </div>
              <div>
                <strong>Nơi làm việc, học tập:</strong> {record.workplace || '..............'}
              </div>
              <div className="col-span-2">
                <strong>Họ tên mẹ hoặc người giám hộ (trẻ ≤16 tuổi):</strong> {record.guardian_name || '................................'}
              </div>
            </div>

            <div className="pt-2">
              <strong className="block mb-2">Đối tượng:</strong>
              <div className="grid grid-cols-2 gap-2 text-sm pl-4">
                {[
                  'Trẻ đi học',
                  'Trẻ không đi học',
                  'Sinh viên, học viên',
                  'Người lao động chính thức (theo Luật An toàn, Vệ sinh lao động)',
                  'Người lao động phi chính thức',
                  'Người cao tuổi'
                ].map((cat) => (
                  <div key={cat} className="flex items-center gap-2">
                    <span>[{record.category === cat ? 'X' : ' '}]</span>
                    <span>{cat}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section II */}
          <div className="space-y-4 my-6">
            <h3 className="font-bold text-lg uppercase border-b border-slate-400 pb-1">
              THÔNG TIN VỀ KHÁM SỨC KHỎE HOẶC KHÁM SÀNG LỌC
            </h3>

            <div className="space-y-3">
              <div>
                <strong>Hình thức khám:</strong>
                <div className="pl-4 space-y-1 mt-1">
                  <p>[{record.exam_type === 'Khám sức khỏe tổng quát' ? 'X' : ' '}] Khám sức khỏe tổng quát</p>
                  <p>[{record.exam_type === 'Khám sàng lọc bệnh' ? 'X' : ' '}] Khám sàng lọc bệnh, ghi rõ:</p>
                  <div className="pl-6 grid grid-cols-2 gap-1 text-sm">
                    {[
                      'Ung thư cổ tử cung',
                      'Ung thư vú',
                      'Ung thư gan',
                      'Ung thư đại trực tràng',
                      'Ung thư tiền liệt tuyến'
                    ].map((item) => (
                      <p key={item}>
                        [{screeningList.includes(item) ? 'X' : ' '}] {item}
                      </p>
                    ))}
                    {record.screening_other && (
                      <p className="col-span-2">[X] Khác: {record.screening_other}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><strong>Ngày khám:</strong> {formatDateVN(record.exam_date)}</div>
                <div><strong>Nơi khám:</strong> {record.exam_location}</div>
              </div>

              <div>
                <strong>Kết quả khám (kết luận):</strong>
                <p className="p-3 border rounded bg-slate-50 italic mt-1">
                  {record.exam_result || 'Chưa ghi nhận kết luận'}
                </p>
              </div>

              {record.attachment_id && (
                <div className="mt-4">
                  <strong>Ảnh/File kết quả khám đính kèm:</strong>
                  <div className="mt-2 max-w-sm border rounded-xl overflow-hidden shadow-sm bg-white">
                    <img
                      src={`/api/attachments/${record.attachment_id}`}
                      alt="Ảnh phiếu khám đính kèm"
                      className="w-full max-h-72 object-contain bg-slate-50"
                      crossOrigin="anonymous"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Signature Footer */}
          <div className="flex justify-between items-end mt-12 pt-6 text-center">
            <div></div>
            <div className="text-center font-bold">
              <p className="italic font-normal">Tân An Hội, ngày ..... tháng {String(new Date().getMonth() + 1).padStart(2, '0')} năm 2026</p>
              <p className="mt-2">Người khai</p>
              <p className="text-xs font-normal italic">(Ký và ghi rõ họ tên)</p>
              <div className="h-20"></div>
              <p className="uppercase">{record.full_name}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
