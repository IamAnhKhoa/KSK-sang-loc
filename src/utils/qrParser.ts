export interface ParsedCCCD {
  cccd: string;
  old_cmnd?: string;
  full_name: string;
  dob: string; // YYYY-MM-DD
  gender: string;
  address: string;
}

/**
 * parseVietnameseAddress — Phân tích địa chỉ QR CCCD Việt Nam thành các phần riêng biệt.
 *
 * Cấu trúc địa chỉ chuẩn:
 *   [Số nhà/Đường], [Ấp/Thôn/Khu], [Xã/Phường/Thị trấn], [Quận/Huyện], [Tỉnh/TP]
 *
 * Ví dụ: "Số 20B Đường Số 24, Ấp 3A, Tân Thạnh Tây, Củ Chi, TP. Hồ Chí Minh"
 *   → current_address = "Số 20B Đường Số 24, Ấp 3A"
 *   → ward            = "Tân Thạnh Tây"
 *   → district        = "Củ Chi"
 *   → city            = "TP. Hồ Chí Minh"
 */
export interface ParsedAddress {
  current_address: string; // Số nhà + Ấp/Thôn/Ngõ
  ward: string;            // Xã/Phường/Thị trấn
  district: string;        // Quận/Huyện
  city: string;            // Tỉnh/TP
  full: string;            // Địa chỉ đầy đủ gốc
}

// Từ khoá nhận biết cấp Ấp/Thôn/Ngõ (cấp thấp hơn Xã)
const SUB_WARD_PREFIXES = ['ấp', 'thôn', 'khu', 'ngõ', 'hẻm', 'phố', 'xóm', 'tổ', 'khóm'];

// Từ khoá nhận biết cấp Xã/Phường/Thị trấn
const WARD_PREFIXES = ['xã', 'phường', 'thị trấn', 'tt.', 'p.', 'x.'];

// Từ khoá nhận biết cấp Quận/Huyện
const DISTRICT_PREFIXES = ['quận', 'huyện', 'thị xã', 'q.', 'h.', 'tx.'];

// Từ khoá nhận biết cấp Tỉnh/TP
const CITY_PREFIXES = ['tỉnh', 'tp.', 'thành phố'];

const startsWithAny = (s: string, prefixes: string[]): boolean => {
  const lower = s.toLowerCase().trim();
  return prefixes.some((p) => lower.startsWith(p));
};

export function parseVietnameseAddress(rawAddress: string): ParsedAddress {
  const full = (rawAddress || '').trim();
  if (!full) {
    return { current_address: '', ward: 'Xã Tân An Hội', district: '', city: '', full };
  }

  // Tách theo dấu phẩy, loại bỏ phần trắng
  const parts = full.split(',').map((p) => p.trim()).filter(Boolean);

  let streetParts: string[] = [];
  let ward = '';
  let district = '';
  let city = '';

  let i = 0;

  // Gom tất cả phần Số nhà/Đường/Ấp vào streetParts cho đến khi gặp Xã/Phường
  while (i < parts.length) {
    const part = parts[i];
    const lp = part.toLowerCase();

    if (startsWithAny(part, WARD_PREFIXES) || startsWithAny(part, DISTRICT_PREFIXES) || startsWithAny(part, CITY_PREFIXES)) {
      // Đây là Xã/Phường hoặc cao hơn — dừng gom streetParts
      break;
    }

    // Nếu phần này là Ấp/Thôn/Khu — vẫn thuộc current_address
    if (startsWithAny(part, SUB_WARD_PREFIXES)) {
      streetParts.push(part);
      i++;
      continue;
    }

    // Kiểm tra phần tiếp theo: nếu tiếp theo là Ấp/Thôn → phần này là street, tiếp tục gom
    const next = parts[i + 1] || '';
    const nextIsSubWard = startsWithAny(next, SUB_WARD_PREFIXES);
    const nextIsWard = startsWithAny(next, WARD_PREFIXES);

    if (streetParts.length === 0 || nextIsSubWard || (!nextIsWard && !startsWithAny(next, DISTRICT_PREFIXES) && !startsWithAny(next, CITY_PREFIXES) && i < parts.length - 3)) {
      streetParts.push(part);
      i++;
    } else {
      break;
    }
  }

  // Lấy Xã/Phường — nếu không có prefix nhận biết, lấy phần đầu tiên không phải street
  if (i < parts.length) {
    const part = parts[i];
    if (startsWithAny(part, DISTRICT_PREFIXES) || startsWithAny(part, CITY_PREFIXES)) {
      // Không có phần Xã riêng — để trống (giữ default)
    } else {
      ward = part;
      i++;
    }
  }

  // Lấy Quận/Huyện
  if (i < parts.length) {
    const part = parts[i];
    if (!startsWithAny(part, CITY_PREFIXES)) {
      district = part;
      i++;
    }
  }

  // Lấy Tỉnh/TP (tất cả phần còn lại)
  if (i < parts.length) {
    city = parts.slice(i).join(', ');
  }

  const current_address = streetParts.join(', ');

  return {
    current_address,
    ward: ward || 'Xã Tân An Hội',
    district,
    city,
    full
  };
}

export function parseVietnameseCCCD(qrText: string): ParsedCCCD | null {
  if (!qrText || typeof qrText !== 'string') return null;

  const text = qrText.trim();

  // 1. Standard Pipe Delimited Format: CCCD|CMND_CŨ|HỌ_TÊN|NGÀY_SINH|GIỚI_TÍNH|ĐỊA_CHỈ|NGÀY_CẤP
  if (text.includes('|')) {
    const parts = text.split('|');
    if (parts.length >= 2) {
      const cccd = parts[0]?.trim() || '';
      const old_cmnd = parts[1]?.trim() || '';
      const rawName = parts[2]?.trim() || '';
      const rawDob = parts[3]?.trim() || '';
      const rawGender = parts[4]?.trim() || '';
      const rawAddress = parts[5]?.trim() || '';

      const cleanedCccd = cccd.replace(/\D/g, '');
      if (cleanedCccd.length >= 9) {
        let dobFormatted = '';
        if (rawDob && rawDob.length === 8) {
          const day = rawDob.substring(0, 2);
          const month = rawDob.substring(2, 4);
          const year = rawDob.substring(4, 8);
          dobFormatted = `${year}-${month}-${day}`;
        }

        let genderFormatted = 'Nam';
        if (rawGender.toLowerCase().includes('nữ') || rawGender.toLowerCase().includes('nu') || rawGender.toUpperCase() === 'F') {
          genderFormatted = 'Nữ';
        }

        return {
          cccd: cleanedCccd,
          old_cmnd: old_cmnd.replace(/\D/g, ''),
          full_name: rawName.toUpperCase(),
          dob: dobFormatted,
          gender: genderFormatted,
          address: rawAddress
        };
      }
    }
  }

  // 2. MRZ Format
  if (text.includes('IDVNM') || text.includes('VNM<<<<')) {
    const lines = text.split(/[\r\n]+/);
    let cccd = '';
    let dob = '';
    let gender = 'Nam';
    let fullName = '';

    for (const line of lines) {
      if (line.startsWith('IDVNM') || line.includes('VNM')) {
        const cccdMatch = line.match(/\d{12}/) || line.match(/\d{9,12}/);
        if (cccdMatch) cccd = cccdMatch[0];
      }
      if (line.includes('VNM') && line.length >= 28) {
        const dobMatch = line.match(/(\d{6})\d([MF])/);
        if (dobMatch) {
          const rawDob = dobMatch[1];
          const yy = parseInt(rawDob.substring(0, 2), 10);
          const mm = rawDob.substring(2, 4);
          const dd = rawDob.substring(4, 6);
          const year = yy > 30 ? `19${yy}` : `20${yy}`;
          dob = `${year}-${mm}-${dd}`;
          gender = dobMatch[2] === 'F' ? 'Nữ' : 'Nam';
        }
      }
      if (line.includes('<<')) {
        const namePart = line.replace(/[^A-Z<]/g, '').split('<<')[0];
        if (namePart) fullName = namePart.replace(/</g, ' ').trim();
      }
    }

    if (cccd) {
      return { cccd, full_name: fullName.toUpperCase(), dob, gender, address: '' };
    }
  }

  // 3. JSON format
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const json = JSON.parse(text);
      if (json.cccd || json.id) {
        return {
          cccd: String(json.cccd || json.id).replace(/\D/g, ''),
          full_name: String(json.full_name || json.name || '').toUpperCase(),
          dob: json.dob || '',
          gender: json.gender || 'Nam',
          address: json.address || ''
        };
      }
    } catch (e) {}
  }

  // 4. Fallback: dãy số
  const digitsMatch = text.match(/\b\d{12}\b/) || text.match(/\b\d{9}\b/);
  if (digitsMatch) {
    return { cccd: digitsMatch[0], full_name: '', dob: '', gender: 'Nam', address: '' };
  }

  return null;
}
