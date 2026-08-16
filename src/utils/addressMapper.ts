/**
 * addressMapper.ts
 * Chuyển đổi địa chỉ từ CCCD (đơn vị hành chính CŨ) sang đơn vị hành chính MỚI 2026
 * Dựa trên bộ dữ liệu: https://github.com/thanglequoc/vietnamese-provinces-database
 */

import { parseVietnameseAddress, ParsedAddress } from './qrParser';

export interface ConvertedAddress {
  current_address: string; // Số nhà, tên đường, ấp/thôn
  ward: string;            // Tên xã/phường mới kèm ghi chú địa chỉ cũ
  district: string;        // Quận/Huyện
  city: string;            // Tỉnh/Thành phố chuẩn
  full: string;            // Địa chỉ gốc
}

// Bảng ánh xạ Xã/Phường & Quận/Huyện cũ -> Xã/Phường MỚI 2026 tại TP. Hồ Chí Minh
const HCM_WARD_MAPPING: Array<{
  oldDistricts?: string[];
  oldWards: string[];
  newWard: string;
}> = [
  // --- HUYỆN CỦ CHI ---
  {
    oldDistricts: ['củ chi', 'cu chi'],
    oldWards: ['tân thạnh tây', 'tan thanh tay', 'tân thạnh đông', 'tan thanh dong', 'phú hòa đông', 'phu hoa dong'],
    newWard: 'Xã Phú Hoà Đông'
  },
  {
    oldDistricts: ['củ chi', 'cu chi'],
    oldWards: ['thị trấn củ chi', 'củ chi', 'cu chi', 'trung an', 'hòa phú', 'hoa phu', 'phước vĩnh an', 'phuoc vinh an', 'phạm văn cội', 'pham van coi'],
    newWard: 'Xã Củ Chi'
  },
  {
    oldDistricts: ['củ chi', 'cu chi'],
    oldWards: ['tân an hội', 'tan an hoi', 'phước hiệp', 'phuoc hiep', 'phước thạnh', 'phuoc thanh', 'trung lập thượng', 'trung lap thuong', 'trung lập hạ', 'trung lap ha'],
    newWard: 'Xã Tân An Hội'
  },
  {
    oldDistricts: ['củ chi', 'cu chi'],
    oldWards: ['an nhơn tây', 'an nhon tay', 'an phú', 'an phu', 'phú mỹ hưng', 'phu my hung'],
    newWard: 'Xã An Nhơn Tây'
  },
  {
    oldDistricts: ['củ chi', 'cu chi'],
    oldWards: ['nhuận đức', 'nhuan duc'],
    newWard: 'Xã Nhuận Đức'
  },
  {
    oldDistricts: ['củ chi', 'cu chi'],
    oldWards: ['thái mỹ', 'thai my'],
    newWard: 'Xã Thái Mỹ'
  },
  {
    oldDistricts: ['củ chi', 'cu chi'],
    oldWards: ['bình mỹ', 'binh my'],
    newWard: 'Xã Bình Mỹ'
  },

  // --- HUYỆN HÓC MÔN ---
  {
    oldDistricts: ['hóc môn', 'hoc mon'],
    oldWards: ['thị trấn hóc môn', 'hóc môn', 'tân xuân', 'thới tam thôn', 'trung chánh', 'tân hiệp'],
    newWard: 'Xã Hóc Môn'
  },
  {
    oldDistricts: ['hóc môn', 'hoc mon'],
    oldWards: ['đông thạnh', 'nhị bình'],
    newWard: 'Xã Đông Thạnh'
  },
  {
    oldDistricts: ['hóc môn', 'hoc mon'],
    oldWards: ['xuân thới sơn', 'tân thới nhì'],
    newWard: 'Xã Xuân Thới Sơn'
  },
  {
    oldDistricts: ['hóc môn', 'hoc mon'],
    oldWards: ['bà điểm', 'ba diem', 'xuân thới thượng', 'xuân thới đông'],
    newWard: 'Xã Bà Điểm'
  },

  // --- HUYỆN BÌNH CHÁNH ---
  {
    oldDistricts: ['bình chánh', 'binh chanh'],
    oldWards: ['vĩnh lộc a', 'vinh loc a', 'phạm văn hai'],
    newWard: 'Xã Vĩnh Lộc'
  },
  {
    oldDistricts: ['bình chánh', 'binh chanh'],
    oldWards: ['vĩnh lộc b', 'vinh loc b', 'lê minh xuân'],
    newWard: 'Xã Tân Vĩnh Lộc'
  },
  {
    oldDistricts: ['bình chánh', 'binh chanh'],
    oldWards: ['bình lợi', 'binh loi'],
    newWard: 'Xã Bình Lợi'
  },
  {
    oldDistricts: ['bình chánh', 'binh chanh'],
    oldWards: ['tân nhựt', 'tan nhut', 'tân túc', 'tân kiên'],
    newWard: 'Xã Tân Nhựt'
  },
  {
    oldDistricts: ['bình chánh', 'binh chanh'],
    oldWards: ['bình chánh', 'binh chanh', 'an phú tây', 'tân quý tây'],
    newWard: 'Xã Bình Chánh'
  },
  {
    oldDistricts: ['bình chánh', 'binh chanh'],
    oldWards: ['hưng long', 'quy đức', 'đa phước'],
    newWard: 'Xã Hưng Long'
  },
  {
    oldDistricts: ['bình chánh', 'binh chanh'],
    oldWards: ['bình hưng', 'binh hung', 'phong phú'],
    newWard: 'Xã Bình Hưng'
  },

  // --- HUYỆN NHÀ BÈ ---
  {
    oldDistricts: ['nhà bè', 'nha be'],
    oldWards: ['nhà bè', 'nha be', 'phước kiển', 'phước lộc', 'phú xuân'],
    newWard: 'Xã Nhà Bè'
  },
  {
    oldDistricts: ['nhà bè', 'nha be'],
    oldWards: ['hiệp phước', 'nhơn đức', 'long thới'],
    newWard: 'Xã Hiệp Phước'
  },

  // --- HUYỆN CẦN GIỜ ---
  {
    oldDistricts: ['cần giờ', 'can gio'],
    oldWards: ['cần thạnh', 'long hòa', 'lý nhơn', 'tam thôn hiệp', 'cần giờ'],
    newWard: 'Xã Cần Giờ'
  },
  {
    oldDistricts: ['cần giờ', 'can gio'],
    oldWards: ['bình khánh', 'binh khanh'],
    newWard: 'Xã Bình Khánh'
  },
  {
    oldDistricts: ['cần giờ', 'can gio'],
    oldWards: ['an thới đông'],
    newWard: 'Xã An Thới Đông'
  },
  {
    oldDistricts: ['cần giờ', 'can gio'],
    oldWards: ['thạnh an'],
    newWard: 'Xã Thạnh An'
  },

  // --- QUẬN GÒ VẤP ---
  {
    oldDistricts: ['gò vấp', 'go vap'],
    oldWards: ['phường 1', 'phường 3', 'phường 4', 'phường 5', 'phường 7', 'p.1', 'p.3', 'p.4', 'p.5', 'p.7', 'p 1', 'p 3', 'p 4', 'p 5', 'p 7', 'phường 01', 'phường 03', 'phường 04', 'phường 05', 'phường 07'],
    newWard: 'Phường Gò Vấp'
  },
  {
    oldDistricts: ['gò vấp', 'go vap'],
    oldWards: ['phường 6', 'phường 10', 'phường 17', 'p.6', 'p.10', 'p.17', 'p 6', 'p 10', 'p 17', 'phường 06'],
    newWard: 'Phường Hạnh Thông'
  },
  {
    oldDistricts: ['gò vấp', 'go vap'],
    oldWards: ['phường 8', 'phường 9', 'phường 11', 'p.8', 'p.9', 'p.11', 'p 8', 'p 9', 'p 11', 'phường 08', 'phường 09'],
    newWard: 'Phường Thông Tây Hội'
  },
  {
    oldDistricts: ['gò vấp', 'go vap'],
    oldWards: ['phường 12', 'phường 13', 'phường 14', 'p.12', 'p.13', 'p.14', 'p 12', 'p 13', 'p 14'],
    newWard: 'Phường An Hội Tây'
  },
  {
    oldDistricts: ['gò vấp', 'go vap'],
    oldWards: ['phường 15', 'phường 16', 'p.15', 'p.16', 'p 15', 'p 16'],
    newWard: 'Phường An Hội Đông'
  },

  // --- QUẬN 1 ---
  {
    oldDistricts: ['quận 1', 'quan 1', 'q.1', 'q 1', 'q1'],
    oldWards: ['tân định', 'đa kao'],
    newWard: 'Phường Tân Định'
  },
  {
    oldDistricts: ['quận 1', 'quan 1', 'q.1', 'q 1', 'q1'],
    oldWards: ['bến nghé', 'bến thành', 'phạm ngũ lão', 'nguyễn thái bình'],
    newWard: 'Phường Bến Thành'
  },
  {
    oldDistricts: ['quận 1', 'quan 1', 'q.1', 'q 1', 'q1'],
    oldWards: ['cô giang', 'cầu kho', 'cầu ông lãnh', 'nguyễn cư trinh'],
    newWard: 'Phường Cầu Ông Lãnh'
  },

  // --- QUẬN BÌNH THẠNH ---
  {
    oldDistricts: ['bình thạnh', 'binh thanh'],
    oldWards: ['phường 1', 'phường 2', 'phường 3', 'phường 14', 'phường 15', 'phường 17', 'phường 19', 'phường 21', 'p.1', 'p.2', 'p.3', 'p.14', 'p.15', 'p.17', 'p.19', 'p.21'],
    newWard: 'Phường Gia Định'
  },
  {
    oldDistricts: ['bình thạnh', 'binh thanh'],
    oldWards: ['phường 5', 'phường 6', 'phường 7', 'phường 11', 'phường 12', 'phường 13', 'p.5', 'p.6', 'p.7', 'p.11', 'p.12', 'p.13'],
    newWard: 'Phường Bình Lợi Trung'
  },
  {
    oldDistricts: ['bình thạnh', 'binh thanh'],
    oldWards: ['phường 22', 'phường 24', 'phường 25', 'p.22', 'p.24', 'p.25'],
    newWard: 'Phường Thạnh Mỹ Tây'
  },
  {
    oldDistricts: ['bình thạnh', 'binh thanh'],
    oldWards: ['phường 26', 'phường 27', 'phường 28', 'p.26', 'p.27', 'p.28'],
    newWard: 'Phường Bình Quới'
  },

  // --- QUẬN BÌNH TÂN ---
  {
    oldDistricts: ['bình tân', 'binh tan'],
    oldWards: ['an lạc', 'an lạc a'],
    newWard: 'Phường An Lạc'
  },
  {
    oldDistricts: ['bình tân', 'binh tan'],
    oldWards: ['bình hưng hòa', 'bình hưng hòa a', 'bình hưng hòa b'],
    newWard: 'Phường Bình Hưng Hòa'
  },
  {
    oldDistricts: ['bình tân', 'binh tan'],
    oldWards: ['bình trị đông', 'bình trị đông a', 'bình trị đông b'],
    newWard: 'Phường Bình Trị Đông'
  },
  {
    oldDistricts: ['bình tân', 'binh tan'],
    oldWards: ['tân tạo', 'tân tạo a'],
    newWard: 'Phường Tân Tạo'
  },

  // --- TP THỦ ĐỨC (Q2, Q9, Thủ Đức Cũ) ---
  {
    oldDistricts: ['thủ đức', 'thu duc', 'quận 2', 'quận 9', 'q.2', 'q.9'],
    oldWards: ['linh xuân', 'linh trung'],
    newWard: 'Phường Linh Xuân'
  },
  {
    oldDistricts: ['thủ đức', 'thu duc', 'quận 2', 'quận 9', 'q.2', 'q.9'],
    oldWards: ['tam bình', 'tam phú', 'bình chiểu'],
    newWard: 'Phường Tam Bình'
  },
  {
    oldDistricts: ['thủ đức', 'thu duc', 'quận 2', 'quận 9', 'q.2', 'q.9'],
    oldWards: ['hiệp bình chánh', 'hiệp bình phước'],
    newWard: 'Phường Hiệp Bình'
  },
  {
    oldDistricts: ['thủ đức', 'thu duc', 'quận 2', 'quận 9', 'q.2', 'q.9'],
    oldWards: ['linh đông', 'linh tây', 'linh chiểu'],
    newWard: 'Phường Thủ Đức'
  },
  {
    oldDistricts: ['thủ đức', 'thu duc', 'quận 2', 'quận 9', 'q.2', 'q.9'],
    oldWards: ['long bình', 'long thạnh mỹ'],
    newWard: 'Phường Long Bình'
  },
  {
    oldDistricts: ['thủ đức', 'thu duc', 'quận 2', 'quận 9', 'q.2', 'q.9'],
    oldWards: ['tăng nhơn phú a', 'tăng nhơn phú b', 'hiệp phú', 'tân phú'],
    newWard: 'Phường Tăng Nhơn Phú'
  },
  {
    oldDistricts: ['thủ đức', 'thu duc', 'quận 2', 'quận 9', 'q.2', 'q.9'],
    oldWards: ['phước long a', 'phước long b', 'phước bình'],
    newWard: 'Phường Phước Long'
  },
  {
    oldDistricts: ['thủ đức', 'thu duc', 'quận 2', 'quận 9', 'q.2', 'q.9'],
    oldWards: ['long phước'],
    newWard: 'Phường Long Phước'
  },
  {
    oldDistricts: ['thủ đức', 'thu duc', 'quận 2', 'quận 9', 'q.2', 'q.9'],
    oldWards: ['long trường', 'trường thạnh'],
    newWard: 'Phường Long Trường'
  },
  {
    oldDistricts: ['thủ đức', 'thu duc', 'quận 2', 'quận 9', 'q.2', 'q.9'],
    oldWards: ['thảo điền', 'an phú', 'an khánh'],
    newWard: 'Phường An Khánh'
  },
  {
    oldDistricts: ['thủ đức', 'thu duc', 'quận 2', 'quận 9', 'q.2', 'q.9'],
    oldWards: ['bình trưng đông', 'bình trưng tây', 'bình an', 'an lợi đông'],
    newWard: 'Phường Bình Trưng'
  },
  {
    oldDistricts: ['thủ đức', 'thu duc', 'quận 2', 'quận 9', 'q.2', 'q.9'],
    oldWards: ['cát lái', 'thạnh mỹ lợi', 'thủ thiêm'],
    newWard: 'Phường Cát Lái'
  }
];

/**
 * Chuẩn hóa tên đơn vị để tìm kiếm mờ (xóa prefix Xã, Phường, Huyện, Quận, Tỉnh...)
 */
function cleanUnitName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/^(xã|phường|thị trấn|thị xã|huyện|quận|tỉnh|tp\.|thành phố|tt\.|p\.|x\.|q\.|h\.)\s+/i, '')
    .trim();
}

/**
 * Hàm chính: Chuyển đổi địa chỉ cũ từ CCCD sang đơn vị hành chính MỚI 2026.
 * Định dạng đầu ra trường xã/phường: "Tên Xã Mới (Xã Cũ, Huyện Cũ cũ)"
 * Ví dụ: "Xã Củ Chi (Tân Thạnh Tây, Củ Chi cũ)"
 */
export interface ConvertedAddress {
  current_address: string; // Số nhà, tên đường, ấp/thôn
  ward: string;            // Tên xã/phường MỚI 2026 (ví dụ: Xã Phú Hoà Đông)
  district: string;        // Quận/Huyện
  city: string;            // Tỉnh/Thành phố chuẩn
  full: string;            // Địa chỉ gốc
  old_address_note?: string; // Ghi chú địa chỉ CŨ từ CCCD (hiển thị ô mờ riêng)
}

/**
 * Hàm làm sạch chuỗi địa chỉ, loại bỏ trùng lặp dấu phẩy (,, hoặc , ,), xóa phẩy thừa ở đầu/cuối.
 */
export function cleanAddressString(addr?: string | null): string {
  if (!addr) return '';
  return addr
    .replace(/,\s*,+/g, ',')
    .replace(/^\s*,+\s*/, '')
    .replace(/\s*,+\s*$/, '')
    .replace(/\s+/g, ' ')
    .replace(/,\s*/g, ', ')
    .trim();
}

/**
 * Hàm chính: Chuyển đổi địa chỉ cũ từ CCCD sang đơn vị hành chính MỚI 2026.
 * - ward: Đơn vị hành chính mới chuẩn 2026 (dùng cho danh mục dropdown & báo cáo SYT)
 * - old_address_note: Ô mờ ghi chú địa chỉ gốc từ CCCD (chỉ hiện khi quét QR)
 */
export function convertOldAddressToNew(rawAddress: string): ConvertedAddress {
  const cleanRaw = cleanAddressString(rawAddress);
  const parsed: ParsedAddress = parseVietnameseAddress(cleanRaw);

  const rawWard = parsed.ward || '';
  const rawDistrict = parsed.district || '';
  const rawCity = parsed.city || '';

  const cleanW = cleanUnitName(rawWard);
  const cleanD = cleanUnitName(rawDistrict);

  let newWard = '';
  let matchFound = false;

  // 1. Tìm trong bảng HCM_WARD_MAPPING (khớp cả district lẫn ward)
  for (const item of HCM_WARD_MAPPING) {
    if (item.oldDistricts && item.oldDistricts.length > 0) {
      const distMatch = item.oldDistricts.some((d) => cleanD.includes(d) || d.includes(cleanD));
      if (!distMatch) continue;
    }
    // Chỉ match ward khi cleanW không rỗng, tránh false-positive
    if (cleanW) {
      const wardMatch = item.oldWards.some((w) => cleanW.includes(w) || w.includes(cleanW));
      if (wardMatch) {
        newWard = item.newWard;
        matchFound = true;
        break;
      }
    }
  }

  // 2. Fallback: nếu ward rỗng nhưng district khớp → lấy entry đầu tiên của district đó
  if (!matchFound && cleanD) {
    for (const item of HCM_WARD_MAPPING) {
      if (!item.oldDistricts || item.oldDistricts.length === 0) continue;
      const distMatch = item.oldDistricts.some((d) => cleanD.includes(d) || d.includes(cleanD));
      if (distMatch) {
        newWard = item.newWard;
        matchFound = true;
        break;
      }
    }
  }

  // 2. Chuỗi thông tin địa chỉ CŨ từ CCCD (ví dụ: Xã Tân Thạnh Tây, Huyện Củ Chi cũ)
  let oldAddressNote = '';
  if (rawWard && rawDistrict) {
    oldAddressNote = `${rawWard}, ${rawDistrict} (cũ)`;
  } else if (rawWard) {
    oldAddressNote = `${rawWard} (cũ)`;
  } else if (rawDistrict) {
    oldAddressNote = `${rawDistrict} (cũ)`;
  }

  let finalWard = 'Xã Tân An Hội';

  if (matchFound && newWard) {
    finalWard = newWard;
  } else if (rawWard) {
    let pref = rawWard.toLowerCase().includes('phường') || rawWard.toLowerCase().startsWith('p.') ? 'Phường' : 'Xã';
    let baseW = rawWard.replace(/^(xã|phường|thị trấn|p\.|x\.|tt\.)\s+/i, '').trim();
    finalWard = `${pref} ${baseW}`;
  }

  // Chuẩn hóa Tỉnh/TP
  let finalCity = 'Thành Phố Hồ Chí Minh';
  if (rawCity) {
    const lcCity = rawCity.toLowerCase();
    if (lcCity.includes('hồ chí minh') || lcCity.includes('hcm')) {
      finalCity = 'Thành Phố Hồ Chí Minh';
    } else {
      finalCity = rawCity;
    }
  }

  return {
    current_address: cleanAddressString(parsed.current_address),
    ward: finalWard,
    district: rawDistrict || 'Huyện Củ Chi',
    city: finalCity,
    full: cleanAddressString(parsed.full),
    old_address_note: cleanAddressString(oldAddressNote)
  };
}

/**
 * Hàm giải quyết địa chỉ dùng chung cho xuất Word & PDF:
 * Tự động trích xuất Xã/Phường thực tế từ `current_address` (nếu có)
 * để tránh lỗi bị gán mặc định thành "Xã Tân An Hội" khi người dân ở xã khác.
 */
export function resolveAddressForExport(r: { current_address?: string; ward?: string; city?: string }) {
  const raw = cleanAddressString(r.current_address);

  if (!raw) {
    return {
      currentAddress: '',
      ward: r.ward || 'Xã Tân An Hội',
      city: r.city || 'Thành Phố Hồ Chí Minh'
    };
  }

  try {
    const converted = convertOldAddressToNew(raw);

    // Ưu tiên xã/phường trích xuất được từ địa chỉ thực tế người dân
    let wardToUse = r.ward || 'Xã Tân An Hội';
    if (converted.ward && converted.ward !== 'Xã Tân An Hội') {
      wardToUse = converted.ward;
    } else if (!r.ward) {
      wardToUse = converted.ward || 'Xã Tân An Hội';
    }

    return {
      currentAddress: raw,
      ward: wardToUse,
      city: converted.city || r.city || 'Thành Phố Hồ Chí Minh'
    };
  } catch {
    return {
      currentAddress: raw,
      ward: r.ward || 'Xã Tân An Hội',
      city: r.city || 'Thành Phố Hồ Chí Minh'
    };
  }
}

