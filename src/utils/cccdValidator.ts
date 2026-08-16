/**
 * @file cccdValidator.ts
 * Validate và phân tích CCCD Việt Nam 12 số
 * Cập nhật theo quy định năm 2026
 * Luôn xử lý CCCD dưới dạng String — không dùng Number/parseInt làm mất số 0 đầu.
 */

// ---- Năm hiện tại — chỉ cập nhật 1 chỗ khi cần ----
const CURRENT_YEAR = 2026;

// ---- Bảng mã tỉnh/thành phố (3 chữ số đầu CCCD) ----
// Có thể cập nhật độc lập khi hệ thống hành chính thay đổi.
const PROVINCE_CODES: Record<string, string> = {
  '001': 'Hà Nội',
  '002': 'Hà Giang',
  '004': 'Cao Bằng',
  '006': 'Bắc Kạn',
  '008': 'Tuyên Quang',
  '010': 'Lào Cai',
  '011': 'Điện Biên',
  '012': 'Lai Châu',
  '014': 'Sơn La',
  '015': 'Yên Bái',
  '017': 'Hoà Bình',
  '019': 'Thái Nguyên',
  '020': 'Lạng Sơn',
  '022': 'Quảng Ninh',
  '024': 'Bắc Giang',
  '025': 'Phú Thọ',
  '026': 'Vĩnh Phúc',
  '027': 'Bắc Ninh',
  '030': 'Hải Dương',
  '031': 'Hải Phòng',
  '033': 'Hưng Yên',
  '034': 'Thái Bình',
  '035': 'Hà Nam',
  '036': 'Nam Định',
  '037': 'Ninh Bình',
  '038': 'Thanh Hoá',
  '040': 'Nghệ An',
  '042': 'Hà Tĩnh',
  '044': 'Quảng Bình',
  '045': 'Quảng Trị',
  '046': 'Thừa Thiên Huế',
  '048': 'Đà Nẵng',
  '049': 'Quảng Nam',
  '051': 'Quảng Ngãi',
  '052': 'Bình Định',
  '054': 'Phú Yên',
  '056': 'Khánh Hoà',
  '058': 'Ninh Thuận',
  '060': 'Bình Thuận',
  '062': 'Kon Tum',
  '064': 'Gia Lai',
  '066': 'Đắk Lắk',
  '067': 'Đắk Nông',
  '068': 'Lâm Đồng',
  '070': 'Bình Phước',
  '072': 'Tây Ninh',
  '074': 'Bình Dương',
  '075': 'Đồng Nai',
  '077': 'Bà Rịa – Vũng Tàu',
  '079': 'TP. Hồ Chí Minh',
  '080': 'Long An',
  '082': 'Tiền Giang',
  '083': 'Bến Tre',
  '084': 'Trà Vinh',
  '086': 'Vĩnh Long',
  '087': 'Đồng Tháp',
  '089': 'An Giang',
  '091': 'Kiên Giang',
  '092': 'Cần Thơ',
  '093': 'Hậu Giang',
  '094': 'Sóc Trăng',
  '095': 'Bạc Liêu',
  '096': 'Cà Mau',
};

// ---- Bảng mã số thứ 4: thế kỷ + giới tính ----
const CENTURY_GENDER_MAP: Record<string, { century: number; gender: 'Nam' | 'Nữ'; baseYear: number }> = {
  '0': { century: 20, gender: 'Nam', baseYear: 1900 },
  '1': { century: 20, gender: 'Nữ', baseYear: 1900 },
  '2': { century: 21, gender: 'Nam', baseYear: 2000 },
  '3': { century: 21, gender: 'Nữ', baseYear: 2000 },
  '4': { century: 22, gender: 'Nam', baseYear: 2100 },
  '5': { century: 22, gender: 'Nữ', baseYear: 2100 },
  '6': { century: 23, gender: 'Nam', baseYear: 2200 },
  '7': { century: 23, gender: 'Nữ', baseYear: 2200 },
  '8': { century: 24, gender: 'Nam', baseYear: 2300 },
  '9': { century: 24, gender: 'Nữ', baseYear: 2300 },
};

// ---- Kiểu trả về ----
export interface CCCDValidResult {
  valid: true;
  cccd: string;
  provinceCode: string;
  provinceName: string;
  gender: 'Nam' | 'Nữ';
  birthYear: number;
  century: number;
  randomCode: string;
  errors: [];
}

export interface CCCDInvalidResult {
  valid: false;
  cccd: string;
  errors: string[];
}

export type CCCDResult = CCCDValidResult | CCCDInvalidResult;

/**
 * validateCCCD — Kiểm tra tính hợp lệ của CCCD 12 số (dạng String).
 * Không khẳng định CCCD có thật; chỉ validate cấu trúc.
 */
export function validateCCCD(raw: string): CCCDResult {
  const errors: string[] = [];

  // Loại bỏ khoảng trắng đầu/cuối — KHÔNG tự sửa số, không thêm số 0
  const cccd = (raw ?? '').trim();

  // Kiểm tra chỉ gồm chữ số
  if (!/^\d+$/.test(cccd)) {
    errors.push('CCCD chỉ được chứa chữ số (0–9), không có chữ cái hay ký tự đặc biệt');
  }

  // Kiểm tra đúng 12 chữ số
  if (cccd.replace(/\D/g, '').length !== 12 || cccd.length !== 12) {
    errors.push(`CCCD phải gồm đúng 12 chữ số (hiện tại: ${cccd.replace(/\D/g, '').length} số)`);
  }

  if (errors.length > 0) {
    return { valid: false, cccd, errors };
  }

  // Phân tích cấu trúc
  const provinceCode = cccd.slice(0, 3);         // Số 1–3
  const centuryGenderCode = cccd[3];             // Số thứ 4
  const yearSuffix = cccd.slice(4, 6);           // Số 5–6 (2 số cuối năm sinh)
  const randomCode = cccd.slice(6, 12);          // Số 7–12

  // Kiểm tra mã thế kỷ/giới tính
  const cgInfo = CENTURY_GENDER_MAP[centuryGenderCode];
  if (!cgInfo) {
    errors.push(`Mã số thứ 4 không hợp lệ: "${centuryGenderCode}" (phải là 0–9)`);
  }

  // Tính năm sinh
  const birthYear = cgInfo ? cgInfo.baseYear + parseInt(yearSuffix, 10) : NaN;

  // Không chấp nhận năm sinh lớn hơn năm hiện tại
  if (!isNaN(birthYear) && birthYear > CURRENT_YEAR) {
    errors.push(`Năm sinh suy ra (${birthYear}) lớn hơn năm hiện tại (${CURRENT_YEAR}) — mã thế kỷ/giới tính không phù hợp`);
  }

  if (errors.length > 0) {
    return { valid: false, cccd, errors };
  }

  return {
    valid: true,
    cccd,
    provinceCode,
    provinceName: PROVINCE_CODES[provinceCode] ?? `Mã tỉnh ${provinceCode} (chưa tra cứu được)`,
    gender: cgInfo!.gender,
    birthYear,
    century: cgInfo!.century,
    randomCode,
    errors: [],
  };
}

/**
 * parseCCCD — Phân tích CCCD và trả về thông tin đọc được.
 * Wrapper thuận tiện trả về object đầy đủ hoặc null nếu không hợp lệ.
 */
export function parseCCCD(raw: string): CCCDValidResult | null {
  const result = validateCCCD(raw);
  return result.valid ? result : null;
}

// ---- TEST ----
if ((import.meta as any).env?.MODE === 'test') {
  const cases = [
    '079099035680',   // Hợp lệ: Nam 1999 HCM
    '07909903568',    // Thiếu 1 số
    '0790990356800',  // Thừa 1 số
    '07909A035680',   // Có chữ
    '079099035@80',   // Có ký tự đặc biệt
    '079499035680',   // Mã 4 = '4' → năm 2099 → hợp lệ nhưng tương lai gần
    '079999035680',   // Năm sinh 2299 > 2026 → không hợp lệ
    ' 079099035680 ', // Có khoảng trắng đầu/cuối — phải pass sau trim
  ];

  console.log('=== TEST validateCCCD ===');
  cases.forEach((c) => {
    const r = validateCCCD(c);
    if (r.valid) {
      console.log(`✓ "${c}" → ${r.gender}, ${r.birthYear}, ${r.provinceName}`);
    } else {
      console.log(`✗ "${c}" → ${r.errors.join(' | ')}`);
    }
  });
}
