import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle
} from 'docx';
import JSZip from 'jszip';
import type { HealthRecord } from '../types';
import { resolveAddressForExport, cleanAddressString } from './addressMapper';

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function resolveWard(r: HealthRecord): { displayName: string; folderName: string } {
  const { ward } = resolveAddressForExport(r);
  if (!ward) {
    return { displayName: 'Chưa phân ấp', folderName: 'Chua_phan_ap' };
  }
  const display = ward.replace(/^(Xã|Phường|Thị trấn|Thị xã)\s+/i, '').trim();
  return { displayName: ward, folderName: safeName(display) };
}

function bold(text: string, size = 24) {
  return new TextRun({ text, bold: true, size, font: 'Times New Roman' });
}
function boldUnderline(text: string, size = 24) {
  return new TextRun({ text, bold: true, size, font: 'Times New Roman', underline: {} });
}
function normal(text: string, size = 24) {
  return new TextRun({ text, size, font: 'Times New Roman' });
}
function italic(text: string, size = 22) {
  return new TextRun({ text, italics: true, size, font: 'Times New Roman' });
}

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

// ─── Official Document Builder (Matching "biểu mẫu ghi nhận dữ liệu sức khỏe.doc") ─────

function buildDoc(r: HealthRecord): Document {
  const { currentAddress, ward, city } = resolveAddressForExport(r);

  const screeningList: string[] = Array.isArray(r.screening_details)
    ? r.screening_details
    : typeof r.screening_details === 'string' && r.screening_details.startsWith('[')
      ? (() => { try { return JSON.parse(r.screening_details!); } catch { return []; } })()
      : [];

  const categories = [
    'Trẻ đi học',
    'Trẻ không đi học',
    'Sinh viên, học viên',
    'Người lao động chính thức (theo Luật An toàn, Vệ sinh lao động)',
    'Người lao động phi chính thức',
    'Người cao tuổi'
  ];

  const screeningOptions = [
    'Ung thư cổ tử cung',
    'Ung thư vú',
    'Ung thư gan',
    'Ung thư đại trực tràng',
    'Ung thư tiền liệt tuyến'
  ];

  return new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 900, bottom: 900, left: 1200, right: 1200 } // 1.6cm / 2.1cm margins
        }
      },
      children: [
        // 1. Header Table (UBND Xã Tân An Hội vs Quốc Hiệu)
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorders,
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [bold('ỦY BAN NHÂN DÂN XÃ TÂN AN HỘI', 19)]
                    }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [boldUnderline('TRẠM Y TẾ', 21)]
                    })
                  ]
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [bold('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 19)]
                    }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [boldUnderline('Độc lập - Tự do - Hạnh phúc', 19)]
                    })
                  ]
                })
              ]
            })
          ]
        }),

        // 2. Title
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 140, after: 40 },
          children: [bold('PHIẾU THU THẬP THÔNG TIN NGƯỜI DÂN', 26)]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [bold('ĐÃ KHÁM SỨC KHỎE HOẶC KHÁM SÀNG LỌC', 24)]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 140 },
          children: [italic('(Kèm theo Công văn số 11292/SYT-NVY ngày 14 tháng 08 năm 2026 của Sở Y tế)', 20)]
        }),

        // 3. Section I - Administrative Info (Matching Exact Word Template Wording)
        new Paragraph({
          spacing: { before: 80, after: 60 },
          children: [bold('THÔNG TIN HÀNH CHÍNH', 22)]
        }),

        new Paragraph({
          spacing: { before: 40, after: 40 },
          children: [
            bold('Họ và tên (viết chữ in hoa): '), bold((r.full_name || '').toUpperCase()),
            normal('        '),
            bold('Giới tính: '), normal(`[${r.gender === 'Nam' ? 'X' : ' '}] Nam    [${r.gender === 'Nữ' ? 'X' : ' '}] Nữ`)
          ]
        }),

        new Paragraph({
          spacing: { before: 40, after: 40 },
          children: [
            bold('Ngày tháng năm sinh: '), normal(fmtDate(r.dob) || '..............'),
            normal('        '),
            bold('Dân tộc: '), normal(r.ethnicity || 'Kinh'),
            normal('        '),
            bold('Nhóm máu (nếu có): '), normal(r.blood_type || '..............')
          ]
        }),

        new Paragraph({
          spacing: { before: 40, after: 40 },
          children: [
            bold('Số CCCD/Mã số định danh: '), bold(r.cccd || '..............'),
            normal('        '),
            bold('Số thẻ BHYT: '), normal(r.bhyt || '..............')
          ]
        }),

        new Paragraph({
          spacing: { before: 40, after: 40 },
          children: [
            bold('Nơi ở hiện tại: '), normal(currentAddress || '........................................'),
          ]
        }),

        new Paragraph({
          spacing: { before: 40, after: 40 },
          children: [
            bold('Xã, phường: '), normal(ward || 'Xã Tân An Hội'),
            normal('        '),
            bold('Thành phố: '), normal(city || 'Thành Phố Hồ Chí Minh')
          ]
        }),

        new Paragraph({
          spacing: { before: 40, after: 40 },
          children: [
            bold('Nghề nghiệp: '), normal(r.job || '..............'),
            normal('        '),
            bold('Nơi làm việc, học tập: '), normal(r.workplace || '..............')
          ]
        }),

        new Paragraph({
          spacing: { before: 40, after: 40 },
          children: [
            bold('Họ tên mẹ hoặc người giám hộ (đối với trẻ từ 16 tuổi trở xuống): '), normal(r.guardian_name || '........................................................')
          ]
        }),

        new Paragraph({
          spacing: { before: 40, after: 60 },
          children: [
            bold('Điện thoại di động: '), normal(r.phone || '..............')
          ]
        }),

        new Paragraph({
          spacing: { before: 40, after: 30 },
          children: [bold('Đối tượng:')]
        }),

        ...categories.map(c => new Paragraph({
          spacing: { before: 20, after: 20 },
          indent: { left: 360 },
          children: [
            normal(`[${r.category === c ? 'X' : ' '}]  ${c}`)
          ]
        })),

        // 4. Section II - Medical Examination Info
        new Paragraph({
          spacing: { before: 140, after: 60 },
          children: [bold('THÔNG TIN VỀ KHÁM SỨC KHỎE HOẶC KHÁM SÀNG LỌC', 22)]
        }),

        new Paragraph({
          spacing: { before: 40, after: 30 },
          children: [bold('Hình thức khám')]
        }),

        new Paragraph({
          spacing: { before: 20, after: 20 },
          indent: { left: 360 },
          children: [normal(`[${r.exam_type === 'Khám sức khỏe tổng quát' ? 'X' : ' '}] Khám sức khỏe tổng quát`)]
        }),

        new Paragraph({
          spacing: { before: 20, after: 20 },
          indent: { left: 360 },
          children: [normal(`[${r.exam_type === 'Khám sàng lọc bệnh' ? 'X' : ' '}] Khám sàng lọc bệnh, ghi rõ:`)]
        }),

        ...screeningOptions.map(opt => new Paragraph({
          spacing: { before: 15, after: 15 },
          indent: { left: 720 },
          children: [normal(`[${screeningList.includes(opt) ? 'X' : ' '}] ${opt}`)]
        })),

        ...(r.screening_other ? [
          new Paragraph({
            spacing: { before: 15, after: 15 },
            indent: { left: 720 },
            children: [normal(`[X] Khác, ghi rõ: ${r.screening_other}`)]
          })
        ] : []),

        new Paragraph({
          spacing: { before: 60, after: 40 },
          children: [
            bold('Ngày khám: '), normal(fmtDate(r.exam_date) || '..............'),
            normal('        '),
            bold('Nơi khám: '), normal(r.exam_location || '..............')
          ]
        }),

        new Paragraph({
          spacing: { before: 40, after: 30 },
          children: [bold('Kết quả khám (ghi theo kết luận của phiếu khám sức khỏe/phiếu khám sàng lọc nếu có):')]
        }),

        new Paragraph({
          spacing: { before: 20, after: 120 },
          indent: { left: 360 },
          children: [italic(r.exam_result || 'Chưa ghi nhận kết luận.')]
        }),

        // 5. Signature Block (Right Aligned Date & Signature)
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorders,
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ children: [normal('')] })]
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [italic(`Tân An Hội, ngày ..... tháng ${String(new Date().getMonth() + 1).padStart(2, '0')} năm 2026`, 21)]
                    }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 40 },
                      children: [bold('Người khai', 21)]
                    }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [italic('(Ký và ghi rõ họ tên)', 19)]
                    }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 550 },
                      children: [bold((r.full_name || '').toUpperCase(), 22)]
                    })
                  ]
                })
              ]
            })
          ]
        })
      ]
    }]
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function exportSingleWord(record: HealthRecord): Promise<void> {
  const doc = buildDoc(record);
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `HS_${safeName(record.full_name || record.cccd || 'Unknown')}_${record.record_id || record.citizen_id}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportZipWord(records: HealthRecord[]): Promise<void> {
  const zip = new JSZip();

  const groups = new Map<string, { displayName: string; records: HealthRecord[] }>();
  for (const r of records) {
    const { displayName, folderName } = resolveWard(r);
    if (!groups.has(folderName)) {
      groups.set(folderName, { displayName, records: [] });
    }
    groups.get(folderName)!.records.push(r);
  }

  for (const [folderName, { records: recs }] of groups.entries()) {
    recs.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'vi'));
    for (let i = 0; i < recs.length; i++) {
      const r = recs[i];
      const doc = buildDoc(r);
      const blob = await Packer.toBlob(doc);
      const arrayBuffer = await blob.arrayBuffer();
      const seq = String(i + 1).padStart(3, '0');
      const filename = `${seq}_${safeName(r.full_name || r.cccd || 'Unknown')}.docx`;
      zip.file(`${folderName}/${filename}`, arrayBuffer);
    }
  }

  zip.file('_DANH_SACH.txt', buildManifest(groups));

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `KSK_2026_Word_${records.length}ban_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildManifest(groups: Map<string, { displayName: string; records: HealthRecord[] }>): string {
  const lines: string[] = [
    'DANH SÁCH HỒ SƠ KSK THEO ẤP / XÃ (ĐƠN VỊ HÀNH CHÍNH MỚI 2026)',
    `Ngày xuất: ${new Date().toLocaleString('vi-VN')}`,
    '═'.repeat(60),
    '',
  ];
  let total = 0;
  for (const [, { displayName, records: recs }] of groups.entries()) {
    lines.push(`📁 ${displayName} — ${recs.length} hồ sơ`);
    for (let i = 0; i < recs.length; i++) {
      const r = recs[i];
      const seq = String(i + 1).padStart(3, '0');
      lines.push(`   ${seq}. ${r.full_name || '—'}   CCCD: ${r.cccd || '—'}   SĐT: ${r.phone || '—'}`);
    }
    total += recs.length;
    lines.push('');
  }
  lines.push('═'.repeat(60));
  lines.push(`TỔNG CỘNG: ${total} hồ sơ — ${groups.size} ấp/khu vực hành chính`);
  return lines.join('\n');
}
