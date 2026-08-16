import html2pdf from 'html2pdf.js';
import type { HealthRecord } from '../types';
import { resolveAddressForExport } from './addressMapper';

function fmtDate(d?: string) {
  if (!d) return '';
  if (d.includes('/')) return d;
  const [y, m, dd] = d.split('-');
  return `${(dd || '').padStart(2, '0')}/${(m || '').padStart(2, '0')}/${y || ''}`;
}

function safeName(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-zA-Z0-9_ .]/g, '_')
    .replace(/_+/g, '_')
    .trim()
    .substring(0, 60);
}

/** Fetch logo image and convert to Base64 to prevent CORS canvas taint issues */
async function getLogoBase64(): Promise<string> {
  try {
    const res = await fetch('/logo.png');
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}function buildHTML(r: HealthRecord, logoSrc: string): string {
  const { currentAddress, ward } = resolveAddressForExport(r);

  const screeningList: string[] = Array.isArray(r.screening_details)
    ? r.screening_details
    : typeof r.screening_details === 'string' && r.screening_details.startsWith('[')
      ? (() => { try { return JSON.parse(r.screening_details!); } catch { return []; } })()
      : [];

  const logoHTML = logoSrc
    ? `<img src="${logoSrc}" alt="Logo" style="width:46px;height:46px;object-fit:cover;border-radius:50%;" />`
    : `<div style="width:46px;height:46px;border-radius:50%;background:#0284c7;color:#fff;font-weight:bold;font-size:16px;line-height:46px;text-align:center;">TYT</div>`;

  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const dots = (n: number) => '.'.repeat(n);

  const dotsOrVal = (val?: string, dotCount: number = 30, uppercase: boolean = false) => {
    const v = (val || '').trim();
    if (!v) return dots(dotCount);
    return `<b style="font-weight:bold;${uppercase ? ' text-transform:uppercase;' : ''}">${v}</b>`;
  };

  // Render CCCD & BHYT boxes via SVG for 100% pixel-perfect vector alignment in html2canvas
  const renderSvgBox = (ch: string) =>
    `<svg width="17" height="20" style="vertical-align:middle;margin-right:1px;display:inline-block;"><rect x="0.5" y="0.5" width="16" height="19" fill="none" stroke="#000" stroke-width="1"/><text x="8.5" y="14" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#000">${ch || ''}</text></svg>`;

  const renderBoxesSvg = (str: string, length: number) => {
    return Array.from({ length }, (_, i) => renderSvgBox(str[i] || '')).join('');
  };

  const cccdStr = (r.cccd || '').replace(/\D/g, '');
  const cccdBoxes = renderBoxesSvg(cccdStr, 12);

  const bhytStr = (r.bhyt || '').replace(/[\s-]/g, '');
  const bhytBoxes1 = renderBoxesSvg(bhytStr.substring(0, 2), 2);
  const bhytBoxes2 = renderBoxesSvg(bhytStr.substring(2), 13);

  // SVG Checkbox square with vector checkmark
  const cb = (checked: boolean) =>
    `<svg width="12" height="12" style="vertical-align:-1px;margin-right:4px;display:inline-block;"><rect x="0.5" y="0.5" width="11" height="11" fill="none" stroke="#000" stroke-width="1"/>${checked ? '<path d="M 2 5.5 L 4.5 8.5 L 9.5 2.5" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' : ''}</svg>`;

  return `
<div style="font-family:'Times New Roman',Times,serif;font-size:11.5px;color:#000;line-height:1.45;padding:12px 24px;background:#fff;width:740px;box-sizing:border-box;margin:0 auto;">
  <!-- Header -->
  <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
    <div style="width:50px;flex-shrink:0;text-align:center;">${logoHTML}</div>
    <div style="flex:1;text-align:center;">
      <div style="font-size:10px;font-weight:bold;text-transform:uppercase;">ỦY BAN NHÂN DÂN XÃ TÂN AN HỘI</div>
      <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;text-decoration:underline;">TRẠM Y TẾ</div>
    </div>
    <div style="flex:1;text-align:center;">
      <div style="font-size:10px;font-weight:bold;text-transform:uppercase;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
      <div style="font-size:10.5px;text-decoration:underline;">Độc lập - Tự do - Hạnh phúc</div>
    </div>
  </div>

  <!-- Title -->
  <div style="text-align:center;margin:4px 0 8px;">
    <div style="font-size:13.5px;font-weight:800;text-transform:uppercase;line-height:1.3;">PHIẾU THU THẬP THÔNG TIN NGƯỜI DÂN<br/>ĐÃ KHÁM SỨC KHỎE HOẶC KHÁM SÀNG LỌC</div>
    <div style="font-size:9.5px;font-style:italic;margin-top:1px;">(Kèm theo Công văn số 11292/SYT-NVY ngày 14 tháng 08 năm 2026 của Sở Y tế)</div>
  </div>

  <!-- A. THÔNG TIN HÀNH CHÍNH -->
  <div style="font-weight:800;font-size:11.5px;margin-bottom:3px;">A.&nbsp;&nbsp;THÔNG TIN HÀNH CHÍNH</div>
  <div style="font-size:11.5px;">
    <div style="padding:1.5px 0;">1.&nbsp;&nbsp;<b>Họ và tên</b> <i>(viết chữ in hoa)</i>: ${dotsOrVal(r.full_name, 45, true)}</div>
    <div style="padding:1.5px 0;">2.&nbsp;&nbsp;<b>Giới tính:</b>&nbsp;${cb(r.gender==='Nam')} Nam &nbsp;&nbsp;&nbsp;&nbsp; ${cb(r.gender==='Nữ')} Nữ</div>
    <div style="padding:1.5px 0;">3.&nbsp;&nbsp;<b>Ngày tháng năm sinh:</b> ${dotsOrVal(fmtDate(r.dob), 30)}</div>
    <div style="padding:1.5px 0;">4.&nbsp;&nbsp;<b>Dân tộc:</b> ${dotsOrVal(r.ethnicity || 'Kinh', 25)}</div>
    <div style="padding:1.5px 0;">5.&nbsp;&nbsp;<b>Nhóm máu</b> <i>(nếu có)</i>: ${dotsOrVal(r.blood_type, 30)}</div>
    <div style="padding:2.5px 0;">6.&nbsp;&nbsp;<b>Số CCCD/Mã số định danh:</b>&nbsp;${cccdBoxes}</div>
    <div style="padding:2.5px 0;">7.&nbsp;&nbsp;<b>Số thẻ BHYT:</b>&nbsp;${bhytBoxes1}&nbsp;-&nbsp;${bhytBoxes2}</div>
    <div style="padding:1.5px 0;">8.&nbsp;&nbsp;<b>Nơi ở hiện tại:</b> ${dotsOrVal(currentAddress, 50)}</div>
    <div style="padding:1.5px 0 1.5px 24px;"><b>Xã, phường:</b> ${dotsOrVal(ward || 'Xã Tân An Hội', 40)}</div>
    <div style="padding:1.5px 0;">9.&nbsp;&nbsp;<b>Nghề nghiệp:</b> ${dotsOrVal(r.job, 45)}</div>
    <div style="padding:1.5px 0;">10.&nbsp;<b>Nơi làm việc, học tập:</b> ${dotsOrVal(r.workplace, 40)}</div>
    <div style="padding:1.5px 0 1.5px 24px;"><b>Xã, phường:</b> ${dotsOrVal('', 50)}</div>
    <div style="padding:1.5px 0;">11.&nbsp;<b>Họ tên mẹ hoặc người giám hộ</b> <i>(đối với trẻ từ 16 tuổi trở xuống)</i>: ${dotsOrVal(r.guardian_name, 30)}</div>
    <div style="padding:1.5px 0;">12.&nbsp;<b>Điện thoại di động:</b> ${dotsOrVal(r.phone, 35)}</div>
    <div style="padding:1.5px 0;">13.&nbsp;<b>Đối tượng:</b></div>
    <!-- 2 Column Layout for Categories to save page height -->
    <table style="width:100%;font-size:11px;margin-left:24px;border-collapse:collapse;">
      <tr>
        <td style="padding:1px 0;width:50%;">${cb(r.category==='Trẻ đi học')} <i>Trẻ đi học</i></td>
        <td style="padding:1px 0;">${cb(r.category==='Người lao động chính thức (theo Luật An toàn, Vệ sinh lao động)')} <i>Người lao động chính thức</i></td>
      </tr>
      <tr>
        <td style="padding:1px 0;">${cb(r.category==='Trẻ không đi học')} <i>Trẻ không đi học</i></td>
        <td style="padding:1px 0;">${cb(r.category==='Người lao động phi chính thức')} <i>Người lao động phi chính thức</i></td>
      </tr>
      <tr>
        <td style="padding:1px 0;">${cb(r.category==='Sinh viên, học viên')} <i>Sinh viên, học viên</i></td>
        <td style="padding:1px 0;">${cb(r.category==='Người cao tuổi')} <i>Người cao tuổi</i></td>
      </tr>
    </table>
  </div>

  <!-- B. THÔNG TIN KHÁM SỨC KHỎE -->
  <div style="font-weight:800;font-size:11.5px;margin:8px 0 3px;">B.&nbsp;&nbsp;THÔNG TIN VỀ KHÁM SỨC KHỎE HOẶC KHÁM SÀNG LỌC</div>
  <div style="font-size:11.5px;">
    <div style="padding:1px 0;"><b>1.&nbsp;&nbsp;Hình thức khám:</b></div>
    <div style="padding-left:18px;">
      <div style="padding:1px 0;">${cb(r.exam_type==='Khám sức khỏe tổng quát')} Khám sức khỏe tổng quát</div>
      <div style="padding:1px 0;">${cb(r.exam_type==='Khám sàng lọc bệnh')} Khám sàng lọc bệnh, ghi rõ:</div>
      <!-- 2 Column Layout for Screening Items -->
      <table style="width:100%;font-size:11px;margin-left:18px;border-collapse:collapse;">
        <tr>
          <td style="padding:1px 0;width:50%;">${cb(screeningList.includes('Ung thư cổ tử cung'))} Ung thư cổ tử cung</td>
          <td style="padding:1px 0;">${cb(screeningList.includes('Ung thư đại trực tràng'))} Ung thư đại trực tràng</td>
        </tr>
        <tr>
          <td style="padding:1px 0;">${cb(screeningList.includes('Ung thư vú'))} Ung thư vú</td>
          <td style="padding:1px 0;">${cb(screeningList.includes('Ung thư tiền liệt tuyến'))} Ung thư tiền liệt tuyến</td>
        </tr>
        <tr>
          <td style="padding:1px 0;">${cb(screeningList.includes('Ung thư gan'))} Ung thư gan</td>
          <td style="padding:1px 0;">${r.screening_other ? `${cb(true)} Khác: ${r.screening_other}` : ''}</td>
        </tr>
      </table>
    </div>
    <div style="padding:2px 0;display:flex;gap:30px;">
      <span><b>2.&nbsp;&nbsp;Ngày khám:</b> ${dotsOrVal(fmtDate(r.exam_date), 20)}</span>
      <span><b>Nơi khám:</b> ${dotsOrVal(r.exam_location, 30)}</span>
    </div>
    <div style="padding:2px 0;"><b>3.&nbsp;&nbsp;Kết quả khám</b> <i>(ghi theo kết luận của phiếu khám sức khỏe / phiếu khám sàng lọc)</i>:</div>
    <div style="border:1px solid #999;border-radius:3px;padding:4px 8px;margin-top:2px;font-style:italic;min-height:28px;font-size:11px;">${r.exam_result || ''}</div>
  </div>

  <!-- Signature -->
  <div style="display:flex;justify-content:flex-end;margin-top:10px;text-align:center;">
    <div style="width:250px;">
      <div style="font-style:italic;font-size:10.5px;">Tân An Hội, ngày ..... tháng ${currentMonth} năm 2026</div>
      <div style="margin-top:2px;font-weight:bold;font-size:11px;">Người khai</div>
      <div style="font-size:10px;font-style:italic;">(Ký và ghi rõ họ tên)</div>
      <div style="height:38px;"></div>
      <div style="text-transform:uppercase;font-weight:bold;font-size:11px;">${r.full_name || ''}</div>
    </div>
  </div>
</div>`;
}

/** Generate PDF using isolated hidden iframe so scrollY is ALWAYS 0 and html2canvas NEVER renders a blank page */
async function generatePDFViaIframe(record: HealthRecord): Promise<Blob> {
  const logoSrc = await getLogoBase64();
  const htmlContent = buildHTML(record, logoSrc);

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position: fixed; left: -9999px; top: 0; width: 794px; height: 1123px; border: none; visibility: hidden;';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    throw new Error('Không thể khởi tạo khung render PDF');
  }

  iframeDoc.open();
  iframeDoc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 0; background: #ffffff; color: #000000; font-family: 'Times New Roman', Times, serif; }
        </style>
      </head>
      <body>${htmlContent}</body>
    </html>
  `);
  iframeDoc.close();

  // Wait 200ms for images and iframe layout to render
  await new Promise((resolve) => setTimeout(resolve, 200));

  const fileNameClean = safeName(record.full_name || record.cccd || 'HoSo');

  const opt = {
    margin: [8, 8, 8, 8],
    filename: `Phieu_KSK_${fileNameClean}.pdf`,
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

  try {
    const pdfBlob = await html2pdf().set(opt).from(iframeDoc.body).output('blob');
    return pdfBlob;
  } finally {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }
}

/** Directly download PDF for a record */
export async function downloadRecordPDF(record: HealthRecord): Promise<void> {
  const blob = await generatePDFViaIframe(record);
  const fileNameClean = safeName(record.full_name || record.cccd || 'HoSo');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Phieu_KSK_${fileNameClean}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Download ZIP of PDFs structured by ward */
export async function exportZipPDF(records: HealthRecord[]): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  const groups = new Map<string, HealthRecord[]>();
  for (const r of records) {
    const ward = (r.ward || 'Chua_phan_ap').replace(/^(Xã|Phường|Thị trấn)\s+/i, '');
    const folderName = safeName(ward) || 'Chua_phan_ap';
    if (!groups.has(folderName)) groups.set(folderName, []);
    groups.get(folderName)!.push(r);
  }

  for (const [folderName, recs] of groups.entries()) {
    recs.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'vi'));
    for (let i = 0; i < recs.length; i++) {
      const r = recs[i];
      const pdfBlob = await generatePDFViaIframe(r);
      const buffer = await pdfBlob.arrayBuffer();
      const seq = String(i + 1).padStart(3, '0');
      const filename = `${seq}_${safeName(r.full_name || r.cccd || 'HoSo')}.pdf`;
      zip.file(`${folderName}/${filename}`, buffer);
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `KSK_2026_PDF_${records.length}ban_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
