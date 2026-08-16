import * as XLSX from 'xlsx';
import { HealthRecord } from '../types';
import catalogs from '../data/sytCatalogs.json';

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

// Map category text to SYT integer code (1-6)
const getCategoryCode = (catName?: string): number => {
  if (!catName) return 5;
  if (catName.includes('Trẻ đi học')) return 1;
  if (catName.includes('Trẻ không đi học')) return 2;
  if (catName.includes('Sinh viên') || catName.includes('học viên')) return 3;
  if (catName.includes('chính thức')) return 4;
  if (catName.includes('phi chính thức')) return 5;
  if (catName.includes('cao tuổi')) return 6;
  return 5;
};

// Map screening disease details to SYT disease codes comma separated (e.g. "1, 2")
const getDiseaseCodes = (details?: string[] | string): string => {
  let list: string[] = [];
  if (Array.isArray(details)) {
    list = details;
  } else if (typeof details === 'string' && details) {
    try {
      list = JSON.parse(details);
    } catch (_) {
      list = [details];
    }
  }

  const codes: number[] = [];
  list.forEach((item) => {
    if (item.includes('cổ tử cung')) codes.push(1);
    else if (item.includes('vú')) codes.push(2);
    else if (item.includes('gan')) codes.push(3);
    else if (item.includes('đại trực tràng')) codes.push(4);
    else if (item.includes('tiền liệt tuyến')) codes.push(5);
  });

  return codes.length > 0 ? codes.join(', ') : '';
};

export const exportToSYTExcel = (records: HealthRecord[], filenameSuffix = '') => {
  if (!records || records.length === 0) {
    alert('Không có dữ liệu để xuất file SYT');
    return;
  }

  const workbook = XLSX.utils.book_new();

  // 1. Build Main Sheet: THÔNG TIN ĐỐI TƯỢNG KSK
  const sheetRows: any[][] = [];

  // Row 0: Hints / Instructions
  sheetRows.push([
    '', '',
    '1: Nam \r\n2: Nữ\r\n3: Chưa xác định',
    'Nhập dạng dd/MM/yyyy',
    'Nhập từ danh mục dân tộc hoặc copy từ sheet dán vào ô nhập liệu',
    'A : Nhóm máu A\r\nB : Nhóm máu B\r\nO : Nhóm máu O\r\nAB: Nhóm máu AB',
    ' 1: Rh-  \r\n2: Rh+',
    'Nhập CCCD 12 số',
    '', '',
    'Chọn từ danh mục Thành phố',
    'Chọn từ danh mục xã phường',
    'Chọn nghề nghiệp ở danh mục hoặc qua sheet danh mục copy tên nghề nghiệp dán vào ô nhập liệu',
    'Chọn nơi công tác ở bên danh mục hoặc qua sheet danh mục copy nơi công tác dán vào ô nhập liệu',
    '', '', '', '', '',
    'Nhập theo mã đối tượng ở sheet đối tượng. Nếu nhập nhiều đối tượng\r\nVí dụ: 1, 2, 3 ',
    '1: Khám sức khỏe tổng quát\r\n2: Khám sàng lọc bệnh',
    'Nhập theo mã bệnh ở sheet BỆNH. Nếu nhập nhiều bệnh:\r\nVí dụ: 1, 2, 3 ',
    '',
    'Chọn từ danh mục hoặc copy ở sheet nơi khám dán vào ô nhập liệu',
    'Nhập dạng (dd/MM/yyyy)',
    '',
    'Chọn từ danh mục hoặc copy ở sheet Đơn vị thu thập dán vào ô nhập liệu'
  ]);

  // Row 1: Human Column Labels
  sheetRows.push([
    'STT', 'Họ và tên*', 'Giới tính*', 'Ngày sinh*', 'Dân tộc*',
    'Nhóm máu', 'Yếu tố nhóm máu', 'Số CMND/CCCD*', 'Bảo hiểm y tế',
    'Chỗ ở hiện tại*', 'Tỉnh *', 'Phường xã*', 'Nghề Nghiệp',
    'Nơi công tác', 'Nơi công tác Tỉnh', 'Nơi công tác xã phường',
    'Họ tên người giám hộ', 'Số CCCD người giám hộ', 'SĐT*',
    'Đối tượng khám*', 'Hình thức khám*', 'Bệnh', 'Bệnh khác',
    'Nơi khám*', 'Ngày khám*', 'Kết quả khám', 'Đơn vị thu thập'
  ]);

  // Row 2: Secondary Headers
  sheetRows.push([
    ...Array(30).fill(''),
    'Nhóm máu', 'Dân tộc', 'Nghề nghiệp', 'Nơi công tác',
    'Tỉnh', 'Phường xã', 'Nơi công tác tỉnh', 'Đơn vị thu thập',
    'Nơi khám', 'Nghề nghiệp', 'Nơi công tác tỉnh', 'Nơi công tác phường, xã'
  ]);

  // Row 3: Index numbers (1) to (26)
  sheetRows.push([
    '', '(1)', '(2)', '(3)', '(4)', '(5)', '(6)', '(7)', '(8)', '(9)',
    '(10)', '(11)', '(12)', '(13)', '(14)', '(15)', '(16)', '(17)',
    '(18)', '(19)', '(20)', '(21)', '(22)', '(23)', '(24)', '(25)', '(26)'
  ]);

  // Row 4: Field names & ID lookup column headers
  sheetRows.push([
    '', 'ho_ten', 'gioi_tinh', 'ngay_sinh', 'dan_toc', 'nhom_mau', 'yeu_to_nhom_mau',
    'dinh_danh_ca_nhan', 'the_bhyt', 'dia_chi_hien_tai', 'city_name', 'ward_name',
    'nghe_nghiep', 'noi_cong_tac', 'noi_cong_tac_tinh', 'noi_cong_tac_xa_phuong',
    'nguoigiamho_hoten', 'nguoigiamho_cccd', 'sdt', 'doi_tuong_kham', 'hinh_thuc_kham',
    'benh', 'benh_khac', 'noi_kham', 'ngay_kham', 'ket_qua_kham', 'don_vi_thu_thap',
    '', '', '',
    'nhom_mau_id', 'dan_toc_id', '', 'noi_cong_tac_id', 'city_id', 'ward_id', '',
    'DonViThuThapId', 'noikham_id', 'nghenghiep_id', 'noi_cong_tac_tinh_id', 'noi_cong_tac_xa_phuong_id'
  ]);

  // Rows 5+: Data rows
  records.forEach((r, idx) => {
    const genderCode = r.gender === 'Nữ' ? 2 : 1;
    const dobFormatted = formatDateVN(r.dob);
    const examDateFormatted = formatDateVN(r.exam_date);
    const categoryCode = getCategoryCode(r.category);
    const hinhThucKham = r.exam_type?.includes('sàng lọc') ? 2 : 1;
    const benhCodes = getDiseaseCodes(r.screening_details);

    // Lookups
    const danTocName = r.ethnicity || 'Kinh';
    const cityName = 'Thành Phố Hồ Chí Minh';
    const wardName = r.ward || 'Xã Tân An Hội';
    const noiKhamName = r.exam_location || 'Trạm y tế Xã Tân An Hội';
    const donViThuThapName = 'Trạm y tế Xã Tân An Hội';

    // Build row values matching 42 columns
    const rowVals = [
      idx + 1,                                // STT
      (r.full_name || '').toUpperCase(),      // ho_ten
      genderCode,                             // gioi_tinh (1/2)
      dobFormatted,                           // ngay_sinh (dd/MM/yyyy)
      danTocName,                             // dan_toc
      r.blood_type || '',                     // nhom_mau
      '',                                     // yeu_to_nhom_mau
      r.cccd || '',                           // dinh_danh_ca_nhan
      r.bhyt || '',                           // the_bhyt
      r.current_address || 'Số 20B Đường Số 24, Ấp 3A, Tân Thạnh Tây, Củ Chi, TP. Hồ Chí Minh', // dia_chi_hien_tai
      cityName,                               // city_name
      wardName,                               // ward_name
      r.job || '',                            // nghe_nghiep
      r.workplace || 'Xã Tân An Hội',         // noi_cong_tac
      cityName,                               // noi_cong_tac_tinh
      wardName,                               // noi_cong_tac_xa_phuong
      r.guardian_name || '',                  // nguoigiamho_hoten
      '',                                     // nguoigiamho_cccd
      r.phone || '',                          // sdt
      categoryCode,                           // doi_tuong_kham (1-6)
      hinhThucKham,                           // hinh_thuc_kham (1/2)
      benhCodes,                              // benh
      r.screening_other || '',                // benh_khac
      noiKhamName,                            // noi_kham
      examDateFormatted,                      // ngay_kham
      r.exam_result || '',                    // ket_qua_kham
      donViThuThapName,                       // don_vi_thu_thap
      '', '', '',                             // empty spacing
      r.blood_type ? 1 : '',                  // nhom_mau_id
      15,                                     // dan_toc_id (15 = Kinh)
      '',                                     // spacing
      '',                                     // noi_cong_tac_id
      50,                                     // city_id (50 = TP.HCM)
      93,                                     // ward_id (93 = Xã Tân An Hội)
      '',                                     // spacing
      25790,                                  // DonViThuThapId (25790 = Trạm y tế Xã Tân An Hội)
      25790,                                  // noikham_id (25790 = Trạm y tế Xã Tân An Hội)
      '',                                     // nghenghiep_id
      50,                                     // noi_cong_tac_tinh_id
      93                                      // noi_cong_tac_xa_phuong_id
    ];

    sheetRows.push(rowVals);
  });

  const mainSheet = XLSX.utils.aoa_to_sheet(sheetRows);
  XLSX.utils.book_append_sheet(workbook, mainSheet, 'THÔNG TIN ĐỐI TƯỢNG KSK');

  // 2. Append Catalog Sheets for full compatibility
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(catalogs.danToc), 'DÂN TỘC');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(catalogs.doiTuongKham), 'ĐỐI TƯỢNG KHÁM');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(catalogs.benh), 'BỆNH');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(catalogs.thanhPho), 'THÀNH PHỐ');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(catalogs.phuongXa), 'PHƯỜNG XÃ');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(catalogs.ngheNghiep), 'NGHỀ NGHIỆP');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(catalogs.noiCongTac), 'NƠI CÔNG TÁC');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(catalogs.noiKham), 'NƠI KHÁM');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(catalogs.donViThuThap), 'ĐƠN VỊ THU THẬP');

  // Save workbook
  const dateToday = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Template_ThuThapThongTin_TanAnHoi_${filenameSuffix}_${dateToday}.xlsx`);
};
