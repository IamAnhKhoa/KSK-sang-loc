import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Users, FileSpreadsheet, Search, Filter, RefreshCw, 
  ChevronLeft, ChevronRight, CheckSquare, Square, Trash2, Eye, RotateCcw, Flame,
  BarChart3, Stethoscope, MapPin, Image as ImageIcon, Loader2, Lock, KeyRound, LogOut, ShieldAlert, X,
  MoreVertical, Edit2, FileText, Archive, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { HealthRecord, StatsData } from '../types';
import { PrintableFormModal } from './PrintableFormModal';
import { cleanAddressString } from '../utils/addressMapper';
import { exportSingleWord, exportZipWord } from '../utils/wordExporter';
import { downloadRecordPDF, exportZipPDF } from '../utils/pdfExporter';

export const AdminDashboard: React.FC = () => {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Authentication State
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return sessionStorage.getItem('admin_token') || null;
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Pagination & Filtering state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [search, setSearch] = useState('');
  const [wardFilter, setWardFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [examTypeFilter, setExamTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Selected Record for Printable Form / Details Modal
  const [selectedRecord, setSelectedRecord] = useState<HealthRecord | null>(null);
  const [detailRecord, setDetailRecord] = useState<HealthRecord | null>(null);
  const [viewAttachmentUrl, setViewAttachmentUrl] = useState<string | null>(null);

  // Popup action menu state
  const [openPopupId, setOpenPopupId] = useState<number | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Edit modal state
  const [editRecord, setEditRecord] = useState<HealthRecord | null>(null);
  const [editForm, setEditForm] = useState<Partial<HealthRecord>>({});
  const [editSaving, setEditSaving] = useState(false);

  // Bulk ZIP loading
  const [zipLoading, setZipLoading] = useState(false);
  const [zipPdfLoading, setZipPdfLoading] = useState(false);

  // Bulk Checkbox Selection State
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Trash Bin State
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [trashRecords, setTrashRecords] = useState<HealthRecord[]>([]);
  const [trashCount, setTrashCount] = useState(0);

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

  // Helper headers for API requests
  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'X-Admin-Password': authToken || ''
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput) {
      setAuthError('Vui lòng nhập mật khẩu quản trị');
      return;
    }

    setIsVerifying(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput.trim() })
      });

      const data = await res.json();
      if (res.ok && data.token) {
        sessionStorage.setItem('admin_token', data.token);
        setAuthToken(data.token);
        setPasswordInput('');
      } else {
        setAuthError(data.error || 'Mật khẩu quản trị không đúng');
      }
    } catch (err: any) {
      setAuthError('Lỗi kết nối máy chủ xác thực');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_token');
    setAuthToken(null);
    setRecords([]);
    setStats(null);
  };

  const fetchStats = async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/admin/stats', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error('Fetch stats error:', err);
    }
  };

  const fetchRecords = async () => {
    if (!authToken) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit)
      });
      if (search) params.append('search', search);
      if (wardFilter) params.append('ward', wardFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      if (examTypeFilter) params.append('exam_type', examTypeFilter);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);

      const res = await fetch(`/api/admin/records?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          handleLogout();
          return;
        }
        throw new Error(data.error || 'Lỗi tải danh sách hồ sơ');
      }

      setRecords(data.data || []);
      setTotalPages(data.totalPages || 1);
      setTotalRecords(data.total || 0);
    } catch (err: any) {
      setError(err.message || 'Không thể kết nối dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrashRecords = async () => {
    try {
      const res = await fetch('/api/admin/trash', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTrashRecords(data.data || []);
        setTrashCount(data.total || 0);
      }
    } catch (err) {
      console.error('Fetch trash error:', err);
    }
  };

  useEffect(() => {
    if (!authToken) return;

    fetchStats();
    fetchRecords();
    fetchTrashRecords();

    const onFocus = () => {
      fetchRecords();
      fetchStats();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [authToken]);

  useEffect(() => {
    if (authToken) {
      fetchRecords();
    }
  }, [page, limit, wardFilter, categoryFilter, examTypeFilter, dateFrom, dateTo]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchRecords();
  };

  const handleDeleteCitizen = async (citizenId: number, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn chuyển hồ sơ người dân "${name}" vào Thùng rác không?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/citizens/${citizenId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        fetchRecords();
        fetchStats();
        fetchTrashRecords();
      } else {
        alert('Lỗi khi xóa hồ sơ');
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Bạn có chắc chắn muốn chuyển ${selectedIds.size} hồ sơ đã chọn vào Thùng rác không?`)) {
      return;
    }
    try {
      const res = await fetch('/api/admin/citizens/bulk-delete', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      if (res.ok) {
        setSelectedIds(new Set());
        fetchRecords();
        fetchStats();
        fetchTrashRecords();
      } else {
        alert('Lỗi khi xóa nhiều hồ sơ');
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    }
  };

  const handleRestore = async (citizenId: number) => {
    try {
      const res = await fetch(`/api/admin/citizens/${citizenId}/restore`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        fetchTrashRecords();
        fetchRecords();
        fetchStats();
      }
    } catch (err: any) {
      alert('Lỗi khi khôi phục: ' + err.message);
    }
  };

  const handlePermanentDelete = async (citizenId: number, name: string) => {
    if (!window.confirm(`XÁC NHẬN CẢNH BÁO: Xóa VĨNH VIỄN hồ sơ "${name}" khỏi hệ thống? Thao tác này KHÔNG thể hoàn tác!`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/citizens/${citizenId}/permanent`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        fetchTrashRecords();
        fetchStats();
      }
    } catch (err: any) {
      alert('Lỗi khi xóa vĩnh viễn: ' + err.message);
    }
  };

  const handleEmptyTrash = async () => {
    if (!window.confirm('CẢNH BÁO NGUY HIỂM: Bạn có chắc chắn muốn DỌN SẠCH VĨNH VIỄN toàn bộ thùng rác không?')) {
      return;
    }
    try {
      const res = await fetch('/api/admin/trash/empty', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        fetchTrashRecords();
        fetchStats();
      }
    } catch (err: any) {
      alert('Lỗi khi dọn dẹp thùng rác: ' + err.message);
    }
  };

  const handleResequence = async () => {
    if (!window.confirm(
      'XẾP LẠI MÃ HS (#ID):\n\nThao tác này sẽ đánh số lại toàn bộ Mã bản ghi theo thứ tự thời gian tạo (từ 1, 2, 3...).\n\nTiếp tục không?'
    )) return;
    try {
      const res = await fetch('/api/admin/resequence', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ Hoàn tất! ${data.message}`);
        fetchRecords();
        fetchStats();
      } else {
        alert('Lỗi: ' + (data.error || 'Không thể xếp lại ID'));
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    }
  };


  // ── Edit save ──────────────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!editRecord) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/citizens/${editRecord.citizen_id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        setEditRecord(null);
        setEditForm({});
        fetchRecords();
      } else {
        const d = await res.json();
        alert('Lỗi lưu: ' + (d.error || 'Không xác định'));
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setEditSaving(false);
    }
  };

  // ── ZIP Word export ────────────────────────────────────────────────────────
  const handleZipWord = async (onlySelected = false) => {
    const source = onlySelected
      ? records.filter(r => selectedIds.has(r.citizen_id!))
      : records;
    if (source.length === 0) { alert('Không có hồ sơ để xuất'); return; }
    setZipLoading(true);
    try {
      await exportZipWord(source);
    } catch (err: any) {
      alert('Lỗi xuất ZIP: ' + err.message);
    } finally {
      setZipLoading(false);
    }
  };

  // ── ZIP PDF export ────────────────────────────────────────────────────────
  const handleZipPDF = async (onlySelected = false) => {
    const source = onlySelected
      ? records.filter(r => selectedIds.has(r.citizen_id!))
      : records;
    if (source.length === 0) { alert('Không có hồ sơ để xuất'); return; }
    setZipPdfLoading(true);
    try {
      await exportZipPDF(source);
    } catch (err: any) {
      alert('Lỗi xuất ZIP PDF: ' + err.message);
    } finally {
      setZipPdfLoading(false);
    }
  };

  // ── Close popup on outside click ───────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setOpenPopupId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Export Excel — xuất tất cả hoặc chỉ các hồ sơ đã chọn
  const exportToExcel = (onlySelected = false) => {
    const source = onlySelected
      ? records.filter((r) => selectedIds.has(r.citizen_id!))
      : records;

    if (source.length === 0) {
      alert('Không có dữ liệu để xuất');
      return;
    }

    const excelData = source.map((r, idx) => ({
      'STT': (page - 1) * limit + idx + 1,
      'Số CCCD/Mã định danh': r.cccd,
      'Họ và tên': r.full_name,
      'Ngày sinh': formatDateVN(r.dob),
      'Giới tính': r.gender,
      'Dân tộc': r.ethnicity,
      'Nhóm máu': r.blood_type || '',
      'Mã thẻ BHYT': r.bhyt || '',
      'Số điện thoại': r.phone || '',
      'Địa chỉ hiện tại': r.current_address || '',
      'Xã/Phường': r.ward || '',
      'Nghề nghiệp': r.job || '',
      'Nơi làm việc/học tập': r.workplace || '',
      'Người giám hộ (nếu <=16t)': r.guardian_name || '',
      'Đối tượng': r.category || '',
      'Hình thức khám': r.exam_type || '',
      'Loại sàng lọc': Array.isArray(r.screening_details) ? r.screening_details.join(', ') : r.screening_details || '',
      'Bệnh sàng lọc khác': r.screening_other || '',
      'Ngày khám': formatDateVN(r.exam_date) || '',
      'Nơi khám': r.exam_location || '',
      'Kết quả khám': r.exam_result || '',
      'Ngày tạo bản ghi': r.record_created_at || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DS_Kham_Suc_Khoe');
    const suffix = onlySelected ? `_ChonLoc${selectedIds.size}` : `_Trang${page}`;
    XLSX.writeFile(workbook, `DS_Kham_Suc_Khoe${suffix}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Unauthenticated Password Protected State
  if (!authToken) {
    return (
      <div className="w-full max-w-md mx-auto my-12 px-4 animate-fade-in">
        <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 text-amber-400 flex items-center justify-center shadow-lg ring-8 ring-slate-100">
              <Lock className="w-8 h-8" />
            </div>
          </div>

          <div className="text-center space-y-1">
            <h3 className="text-2xl font-extrabold text-slate-900 uppercase">
              XÁC THỰC QUẢN TRỊ
            </h3>
            <p className="text-slate-500 text-sm font-medium">
              Vui lòng nhập mật khẩu quản trị để truy cập dữ liệu báo cáo (/manage)
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {authError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 text-red-700 font-bold text-sm">
                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <div className="relative">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Nhập mật khẩu quản trị..."
                className="w-full pl-12 pr-4 py-4 border-2 border-slate-300 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none text-lg font-mono"
                autoFocus
              />
              <KeyRound className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-extrabold text-lg py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Đang kiểm tra...</span>
                </>
              ) : (
                <span>ĐĂNG NHẬP QUẢN TRỊ</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto my-6 px-4 pb-12 space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-800">
        <div>
          <span className="inline-block bg-sky-500/20 text-sky-300 text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border border-sky-500/30 mb-2">
            TRANG QUẢN TRỊ BÁO CÁO (/MANAGE)
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold">HỆ THỐNG QUẢN LÝ DỮ LIỆU SỨC KHỎE NGƯỜI DÂN</h2>
          <p className="text-slate-400 text-sm mt-1">
            Tổng hợp dữ liệu khám sức khỏe & khám sàng lọc toàn địa bàn
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <button
            onClick={() => { fetchRecords(); fetchStats(); fetchTrashRecords(); }}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 border border-slate-700 transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Làm mới</span>
          </button>

          <button
            onClick={handleResequence}
            className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 border border-indigo-500/30 transition-all active:scale-95"
            title="Đánh số lại Mã bản ghi (#ID) liên tục từ 1 theo thứ tự thời gian tạo"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Xếp lại Mã HS</span>
          </button>

          <button
            onClick={() => { fetchTrashRecords(); setIsTrashOpen(true); }}
            className="bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 border border-amber-500/30 transition-all active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            <span>Thùng Rác ({trashCount})</span>
          </button>

          <button
            onClick={() => exportToExcel(false)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
            title="Xuất file Excel báo cáo tổng hợp"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất Excel ({totalRecords})</span>
          </button>

          <button
            onClick={async () => {
              const { exportToSYTExcel } = await import('../utils/sytExporter');
              const selectedSource = selectedIds.size > 0 
                ? records.filter(r => selectedIds.has(r.citizen_id!))
                : records;
              exportToSYTExcel(selectedSource, selectedIds.size > 0 ? `ChonLoc${selectedIds.size}` : `Trang${page}`);
            }}
            className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-sky-600/20 transition-all active:scale-95 border border-sky-400/30"
            title="Xuất file Excel chuẩn cấu trúc và danh mục để Import trực tiếp vào phần mềm Sở Y Tế"
          >
            <FileSpreadsheet className="w-4 h-4 text-sky-200" />
            <span>Xuất Mẫu Import SYT</span>
          </button>

          <button
            onClick={handleLogout}
            title="Đăng xuất khỏi trang quản trị"
            className="bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 border border-red-500/30 transition-all active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Tổng Người Dân</p>
              <h3 className="text-2xl font-extrabold text-slate-900">{(stats.totalCitizens || 0).toLocaleString()}</h3>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <BarChart3 className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Tổng Lượt Khám</p>
              <h3 className="text-2xl font-extrabold text-slate-900">{(stats.totalRecords || 0).toLocaleString()}</h3>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center">
              <Stethoscope className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Khám Sàng Lọc</p>
              <h3 className="text-2xl font-extrabold text-slate-900">
                {((stats.byExamType && Array.isArray(stats.byExamType) ? (stats.byExamType.find(e => e.exam_type === 'Khám sàng lọc bệnh')?.count || 0) : 0)).toLocaleString()}
              </h3>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <MapPin className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Địa Bàn Chính</p>
              <h3 className="text-lg font-extrabold text-slate-900 truncate max-w-[140px]">
                {(stats.byWard && Array.isArray(stats.byWard) && stats.byWard[0]?.ward) || 'Xã Tân An Hội'}
              </h3>
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="space-y-3">
          {/* Row 1: Search + Exam Type + Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2 relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo Mã bản ghi (#13), CCCD, Họ và tên, SĐT..."
                className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none text-base font-medium"
              />
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>

            <select
              value={examTypeFilter}
              onChange={(e) => { setExamTypeFilter(e.target.value); setPage(1); }}
              className="w-full py-3 px-4 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none text-base font-medium bg-white"
            >
              <option value="">-- Tất cả hình thức khám --</option>
              <option value="Khám sức khỏe tổng quát">Khám sức khỏe tổng quát</option>
              <option value="Khám sàng lọc bệnh">Khám sàng lọc bệnh</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="w-full py-3 px-4 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none text-base font-medium bg-white"
            >
              <option value="">-- Tất cả nhóm đối tượng --</option>
              <option value="Trẻ đi học">Trẻ đi học</option>
              <option value="Trẻ không đi học">Trẻ không đi học</option>
              <option value="Sinh viên, học viên">Sinh viên, học viên</option>
              <option value="Người lao động chính thức (theo Luật ATVSLĐ)">Lao động chính thức</option>
              <option value="Người lao động phi chính thức">Lao động phi chính thức</option>
              <option value="Người cao tuổi">Người cao tuổi</option>
            </select>
          </div>

          {/* Row 2: Date Range Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Từ ngày khám</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="w-full py-3 px-4 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none text-base font-medium"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Đến ngày khám</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="w-full py-3 px-4 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none text-base font-medium"
              />
            </div>

            <div className="flex items-center gap-2 sm:col-span-2 justify-between pt-2">
              <div className="flex items-center gap-2 text-sm text-slate-500 font-semibold">
                <Filter className="w-4 h-4" />
                <span>{records.length} / {totalRecords} hồ sơ</span>
                {(dateFrom || dateTo || examTypeFilter || categoryFilter || search) && (
                  <button
                    type="button"
                    onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setExamTypeFilter(''); setCategoryFilter(''); setPage(1); }}
                    className="text-red-500 hover:text-red-700 font-bold text-xs flex items-center gap-1 ml-1"
                  >
                    <X className="w-3.5 h-3.5" />Xóa bộ lọc
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all"
              >
                Áp dụng & Tìm
              </button>
            </div>
          </div>
        </form>

        {/* Bulk Action Bar — shows when records are selected */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 p-3.5 bg-sky-50 border-2 border-sky-200 rounded-2xl animate-fade-in">
            <CheckSquare className="w-5 h-5 text-sky-600" />
            <span className="text-sky-800 font-extrabold text-sm">
              Đã chọn {selectedIds.size} hồ sơ
            </span>
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <button
                onClick={() => exportToExcel(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel ({selectedIds.size})
              </button>
              <button
                onClick={async () => {
                  const { exportToSYTExcel } = await import('../utils/sytExporter');
                  const selectedSource = records.filter(r => selectedIds.has(r.citizen_id!));
                  exportToSYTExcel(selectedSource, `ChonLoc${selectedIds.size}`);
                }}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Mẫu SYT ({selectedIds.size})
              </button>
              <button
                onClick={() => handleZipWord(true)}
                disabled={zipLoading}
                title="Xuất ZIP Word theo ấp/xã (hành chính mới)"
                className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md disabled:opacity-60"
              >
                {zipLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                ZIP Word ({selectedIds.size})
              </button>
              <button
                onClick={() => handleZipPDF(true)}
                disabled={zipPdfLoading}
                title="Xuất ZIP PDF theo ấp/xã (hành chính mới)"
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md disabled:opacity-60"
              >
                {zipPdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                ZIP PDF ({selectedIds.size})
              </button>
              <button
                onClick={handleBulkDelete}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xóa ({selectedIds.size})
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-slate-500 hover:text-slate-800 font-bold text-xs px-2"
              >
                Bỏ chọn
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <Loader2 className="w-10 h-10 animate-spin text-sky-600 mx-auto" />
            <p className="font-semibold text-lg">Đang tải dữ liệu hồ sơ từ D1 database...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 font-bold">{error}</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium">
            Không tìm thấy hồ sơ phù hợp.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 text-xs uppercase font-extrabold tracking-wider border-b border-slate-200">
                  {/* Select All Checkbox */}
                  <th className="py-4 px-3 text-center w-10">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedIds.size === records.length) {
                          setSelectedIds(new Set());
                        } else {
                          setSelectedIds(new Set(records.map((r) => r.citizen_id!)));
                        }
                      }}
                      className="text-slate-500 hover:text-sky-600 transition-colors"
                    >
                      {selectedIds.size === records.length && records.length > 0
                        ? <CheckSquare className="w-5 h-5 text-sky-600" />
                        : <Square className="w-5 h-5" />}
                    </button>
                  </th>
                  <th className="py-4 px-3 text-center">STT</th>
                  <th className="py-4 px-3">Mã HS (#ID)</th>
                  <th className="py-4 px-3">Số CCCD</th>
                  <th className="py-4 px-3">Họ và Tên</th>
                  <th className="py-4 px-3">Ngày Sinh / GT</th>
                  <th className="py-4 px-3">Địa Chỉ / Điện Thoại</th>
                  <th className="py-4 px-3">Hình Thức Khám</th>
                  <th className="py-4 px-3">Ngày Khám</th>
                  <th className="py-4 px-3 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm font-medium text-slate-800">
                {records.map((r, index) => {
                  const isChecked = selectedIds.has(r.citizen_id!);
                  return (
                  <tr
                    key={`${r.citizen_id}-${r.record_id ?? 'no-rec'}`}
                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${isChecked ? 'bg-sky-50' : ''}`}
                    onClick={() => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(r.citizen_id!)) next.delete(r.citizen_id!);
                        else next.add(r.citizen_id!);
                        return next;
                      });
                    }}
                  >
                    {/* Checkbox */}
                    <td className="py-4 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(r.citizen_id!)) next.delete(r.citizen_id!);
                            else next.add(r.citizen_id!);
                            return next;
                          });
                        }}
                        className="text-slate-400 hover:text-sky-600"
                      >
                        {isChecked
                          ? <CheckSquare className="w-5 h-5 text-sky-600" />
                          : <Square className="w-5 h-5" />}
                      </button>
                    </td>
                    <td className="py-4 px-3 text-center font-bold text-slate-500">
                      {(page - 1) * limit + index + 1}
                    </td>
                    <td className="py-4 px-3">
                      <span className="bg-sky-100 text-sky-900 font-mono font-extrabold text-xs px-2 py-1 rounded-md border border-sky-200 shadow-sm inline-block">
                        #{r.record_id || r.citizen_id || '—'}
                      </span>
                    </td>
                    <td className="py-4 px-3 font-mono font-bold text-sky-900">
                      {r.cccd}
                    </td>
                    <td className="py-4 px-3 font-extrabold text-slate-900 uppercase">
                      {r.full_name}
                      <span className="block text-xs font-normal text-slate-500">{r.category}</span>
                    </td>
                    <td className="py-4 px-3">
                      {formatDateVN(r.dob)}
                      <span className="block text-xs text-slate-500">{r.gender}</span>
                    </td>
                    <td className="py-4 px-3">
                      <span className="font-semibold text-slate-900">{r.phone || 'Chưa có SĐT'}</span>
                      <span className="block text-xs text-slate-600 truncate max-w-[200px]" title={cleanAddressString(r.current_address)}>
                        {cleanAddressString(r.current_address) || r.ward}
                      </span>
                      {r.old_address_note && (
                        <span className="block text-[11px] text-amber-700 italic truncate max-w-[200px]" title={`Địa chỉ gốc CCCD: ${r.old_address_note}`}>
                          ({r.old_address_note})
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-3">
                      {r.exam_type ? (
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                          r.exam_type === 'Khám sàng lọc bệnh'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {r.exam_type}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Chưa khám</span>
                      )}
                    </td>
                    <td className="py-4 px-3 text-slate-600 font-mono text-xs">
                      {formatDateVN(r.exam_date) || <span className="text-slate-400 italic">—</span>}
                    </td>
                    <td className="py-4 px-3 relative" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {/* Direct Quick Action Buttons */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDetailRecord(r); }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-sky-100 text-slate-600 hover:text-sky-700 transition-colors"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditRecord(r);
                            setEditForm({
                              phone: r.phone, job: r.job, workplace: r.workplace,
                              guardian_name: r.guardian_name, ethnicity: r.ethnicity,
                              blood_type: r.blood_type, bhyt: r.bhyt, category: r.category,
                              exam_type: r.exam_type, exam_date: r.exam_date,
                              exam_location: r.exam_location, exam_result: r.exam_result
                            });
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-700 transition-colors"
                          title="Chỉnh sửa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try { await downloadRecordPDF(r); } catch (err: any) { alert('Lỗi xuất PDF: ' + err.message); }
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 transition-colors"
                          title="Tải PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try { await exportSingleWord(r); } catch (err: any) { alert('Lỗi xuất Word: ' + err.message); }
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-violet-100 text-slate-600 hover:text-violet-700 transition-colors"
                          title="Tải Word (.docx)"
                        >
                          <FileText className="w-4 h-4" />
                        </button>

                        {/* More Options Dropdown */}
                        <div className="relative inline-block">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenPopupId(openPopupId === r.citizen_id ? null : r.citizen_id!);
                            }}
                            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
                            title="Tùy chọn khác"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openPopupId === r.citizen_id && (
                            <div
                              ref={popupRef}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 bottom-full mb-1 sm:bottom-auto sm:top-full sm:mt-1 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl w-48 py-1.5 animate-fade-in text-left"
                            >
                              <button
                                type="button"
                                onClick={() => { setDetailRecord(r); setOpenPopupId(null); }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-sky-50 hover:text-sky-800 transition-colors"
                              >
                                <Eye className="w-4 h-4 text-sky-600 flex-shrink-0" />
                                Xem chi tiết
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditRecord(r);
                                  setEditForm({
                                    phone: r.phone, job: r.job, workplace: r.workplace,
                                    guardian_name: r.guardian_name, ethnicity: r.ethnicity,
                                    blood_type: r.blood_type, bhyt: r.bhyt, category: r.category,
                                    exam_type: r.exam_type, exam_date: r.exam_date,
                                    exam_location: r.exam_location, exam_result: r.exam_result
                                  });
                                  setOpenPopupId(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-800 transition-colors"
                              >
                                <Edit2 className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                Sửa thông tin
                              </button>

                              <div className="border-t border-slate-100 my-1" />

                              <button
                                type="button"
                                onClick={async () => {
                                  setOpenPopupId(null);
                                  try { await downloadRecordPDF(r); } catch (e: any) { alert('Lỗi tải PDF: ' + e.message); }
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                              >
                                <Download className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                Tải PDF
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  setOpenPopupId(null);
                                  try { await exportSingleWord(r); } catch (e: any) { alert('Lỗi xuất Word: ' + e.message); }
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-violet-50 hover:text-violet-800 transition-colors"
                              >
                                <FileText className="w-4 h-4 text-violet-600 flex-shrink-0" />
                                Tải Word (.docx)
                              </button>

                              {r.attachment_id && (
                                <button
                                  type="button"
                                  onClick={() => { setViewAttachmentUrl(`/api/attachments/${r.attachment_id}`); setOpenPopupId(null); }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-800 transition-colors"
                                >
                                  <ImageIcon className="w-4 h-4 text-purple-600 flex-shrink-0" />
                                  Xem ảnh kèm
                                </button>
                              )}

                              <div className="border-t border-slate-100 my-1" />

                              <button
                                type="button"
                                onClick={() => { handleDeleteCitizen(r.citizen_id!, r.full_name || ''); setOpenPopupId(null); }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4 flex-shrink-0" />
                                Xóa hồ sơ
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server Pagination Bar with Page Size Selector (50, 200, 500, 1000, 3000, 5000) */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="px-4 py-2 bg-white border border-slate-300 rounded-xl font-bold text-sm text-slate-700 disabled:opacity-50 flex items-center gap-1 hover:bg-slate-100 active:scale-95 transition-all shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              Trang Trước
            </button>

            <span className="text-sm font-bold text-slate-700">
              Trang <span className="text-sky-700">{page}</span> / {totalPages} (Tổng <span className="text-slate-900">{totalRecords}</span> bản ghi)
            </span>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              className="px-4 py-2 bg-white border border-slate-300 rounded-xl font-bold text-sm text-slate-700 disabled:opacity-50 flex items-center gap-1 hover:bg-slate-100 active:scale-95 transition-all shadow-sm"
            >
              Trang Sau
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Page Size Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Hiển thị:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="py-2 px-3 bg-white border-2 border-slate-300 rounded-xl font-extrabold text-sm text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none shadow-sm cursor-pointer"
            >
              <option value={50}>50 / trang</option>
              <option value={200}>200 / trang</option>
              <option value={500}>500 / trang</option>
              <option value={1000}>1,000 / trang</option>
              <option value={3000}>3,000 / trang</option>
              <option value={5000}>5,000 / trang</option>
            </select>
          </div>
        </div>
      </div>

      {/* View Printable Modal */}
      {selectedRecord && (
        <PrintableFormModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}

      {/* Detail View Modal */}
      {detailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6">
            <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">CHI TIẾT HỒ SƠ NGƯỜI DÂN</span>
                <h3 className="text-xl font-extrabold uppercase mt-0.5">{detailRecord.full_name}</h3>
              </div>
              <button
                onClick={() => setDetailRecord(null)}
                className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-slate-800 text-sm max-h-[75vh] overflow-y-auto">
              {/* Record ID Banner */}
              <div className="bg-sky-900 text-white p-3.5 rounded-2xl flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-xs text-sky-200 uppercase font-bold tracking-wider block">Mã bản ghi hệ thống</span>
                  <span className="text-xl font-mono font-extrabold text-emerald-400">#{detailRecord.record_id || detailRecord.citizen_id || '—'}</span>
                </div>
                {detailRecord.record_created_at && (
                  <div className="text-right text-xs text-sky-200">
                    <div>Ngày khởi tạo hồ sơ:</div>
                    <div className="font-bold text-white">{formatDateVN(detailRecord.record_created_at)}</div>
                  </div>
                )}
              </div>

              {/* Personal Info Grid */}
              <div className="bg-slate-50 p-4 rounded-2xl space-y-3 border border-slate-200">
                <h4 className="font-extrabold text-slate-900 uppercase text-xs tracking-wider border-b border-slate-200 pb-2">
                  1. THÔNG TIN CÁ NHÂN
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><strong>Số CCCD:</strong> <span className="font-mono text-sky-900 font-bold">{detailRecord.cccd}</span></div>
                  <div><strong>Họ và tên:</strong> <span className="uppercase font-bold">{detailRecord.full_name}</span></div>
                  <div><strong>Ngày sinh:</strong> {formatDateVN(detailRecord.dob)}</div>
                  <div><strong>Giới tính:</strong> {detailRecord.gender}</div>
                  <div><strong>Dân tộc:</strong> {detailRecord.ethnicity || 'Kinh'}</div>
                  <div><strong>Nhóm máu:</strong> {detailRecord.blood_type || 'Chưa cập nhật'}</div>
                  <div><strong>Mã BHYT:</strong> {detailRecord.bhyt || 'Chưa có'}</div>
                  <div><strong>Số điện thoại:</strong> <span className="font-bold">{detailRecord.phone || 'Chưa có SĐT'}</span></div>
                  <div className="sm:col-span-2"><strong>Địa chỉ hiện tại:</strong> {cleanAddressString(detailRecord.current_address) || '—'}</div>
                  {detailRecord.old_address_note && (
                    <div className="sm:col-span-2">
                      <strong>Địa chỉ gốc (CCCD cũ):</strong>{' '}
                      <span className="italic text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200 font-medium">
                        {detailRecord.old_address_note}
                      </span>
                    </div>
                  )}
                  <div><strong>Xã/Phường:</strong> {detailRecord.ward || 'Xã Tân An Hội'}</div>
                  <div><strong>Nghề nghiệp:</strong> {detailRecord.job || '—'}</div>
                  <div><strong>Nơi làm việc:</strong> {detailRecord.workplace || 'Xã Tân An Hội'}</div>
                  {detailRecord.guardian_name && <div><strong>Người giám hộ:</strong> {detailRecord.guardian_name}</div>}
                  <div className="sm:col-span-2"><strong>Phân loại đối tượng:</strong> <span className="inline-block bg-sky-100 text-sky-800 px-2.5 py-0.5 rounded-md font-bold">{detailRecord.category}</span></div>
                </div>
              </div>

              {/* Health Record Info */}
              <div className="bg-emerald-50/60 p-4 rounded-2xl space-y-3 border border-emerald-200">
                <h4 className="font-extrabold text-emerald-900 uppercase text-xs tracking-wider border-b border-emerald-200 pb-2">
                  2. THÔNG TIN KHÁM SỨC KHỎE
                </h4>
                {detailRecord.record_id ? (
                  <div className="space-y-2">
                    <div><strong>Hình thức khám:</strong> <span className="font-bold text-emerald-800">{detailRecord.exam_type}</span></div>
                    <div><strong>Ngày khám:</strong> {formatDateVN(detailRecord.exam_date)}</div>
                    <div><strong>Nơi khám:</strong> {detailRecord.exam_location || '—'}</div>
                    {detailRecord.screening_details && (
                      <div><strong>Nội dung sàng lọc:</strong> {Array.isArray(detailRecord.screening_details) ? detailRecord.screening_details.join(', ') : detailRecord.screening_details}</div>
                    )}
                    {detailRecord.screening_other && <div><strong>Sàng lọc khác:</strong> {detailRecord.screening_other}</div>}
                    <div><strong>Kết quả khám:</strong> <p className="mt-1 p-3 bg-white border border-emerald-200 rounded-xl italic">{detailRecord.exam_result || 'Chưa có kết luận'}</p></div>
                    {detailRecord.attachment_id && (
                      <div className="pt-2">
                        <strong>Ảnh/File kết quả khám đính kèm:</strong>
                        <div className="mt-2 relative max-w-xs rounded-2xl overflow-hidden shadow-md border border-slate-200 bg-white">
                          <img
                            src={`/api/attachments/${detailRecord.attachment_id}`}
                            alt="Ảnh phiếu khám đính kèm"
                            className="w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setViewAttachmentUrl(`/api/attachments/${detailRecord.attachment_id}`)}
                          />
                          <div className="bg-slate-900/60 text-white text-[11px] font-bold py-1 text-center">
                            Nhấp để mở xem ảnh lớn
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500 italic">Người dân này chưa điền thông tin phiếu khám sức khỏe.</p>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="bg-slate-100 p-4 flex items-center justify-between border-t border-slate-200">
              <button
                onClick={() => handleDeleteCitizen(detailRecord.citizen_id!, detailRecord.full_name || '')}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Xóa Hồ Sơ
              </button>

              <div className="flex items-center gap-3">
                {detailRecord.record_id && (
                  <button
                    onClick={async () => {
                      try {
                        await downloadRecordPDF(detailRecord);
                      } catch (e: any) {
                        alert('Lỗi tải PDF: ' + e.message);
                      }
                    }}
                    className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Tải PDF về máy
                  </button>
                )}
                <button
                  onClick={() => setDetailRecord(null)}
                  className="bg-slate-300 hover:bg-slate-400 text-slate-800 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Image Preview Modal */}
      {viewAttachmentUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-white p-4 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b">
              <h4 className="font-bold text-lg">Ảnh Phiếu Khám / Kết Quả Tải Lên</h4>
              <button onClick={() => setViewAttachmentUrl(null)} className="p-1 rounded-full text-slate-400 hover:text-slate-900">✕</button>
            </div>
            <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-slate-100 rounded-2xl mt-3">
              <img src={viewAttachmentUrl} alt="Phiếu khám" className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-md" />
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ────────────────────────────────────────────────────── */}
      {editRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden my-6">
            <div className="bg-amber-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Edit2 className="w-5 h-5" />
                <div>
                  <p className="font-extrabold text-base leading-tight">CHỈNH SỬA HỒ SƠ</p>
                  <p className="text-amber-100 text-xs">{editRecord.full_name} — CCCD: {editRecord.cccd}</p>
                </div>
              </div>
              <button onClick={() => setEditRecord(null)} className="p-1.5 rounded-full hover:bg-amber-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thông tin cá nhân</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['SĐT', 'phone', 'tel'],
                  ['Nghề nghiệp', 'job', 'text'],
                  ['Nơi làm việc', 'workplace', 'text'],
                  ['Người giám hộ', 'guardian_name', 'text'],
                  ['Dân tộc', 'ethnicity', 'text'],
                  ['Nhóm máu', 'blood_type', 'text'],
                  ['Mã BHYT', 'bhyt', 'text'],
                ] as [string, keyof typeof editForm, string][]).map(([label, key, type]) => (
                  <div key={key}>
                    <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
                    <input
                      type={type}
                      value={(editForm[key] as string) || ''}
                      onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 outline-none"
                    />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Phân loại đối tượng</label>
                  <select
                    value={editForm.category || ''}
                    onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 outline-none bg-white"
                  >
                    {['Trẻ đi học','Trẻ không đi học','Sinh viên, học viên','Người lao động chính thức (theo Luật ATVSLĐ)','Người lao động phi chính thức','Người cao tuổi'].map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider pt-2">Thông tin khám</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Hình thức khám</label>
                  <select
                    value={editForm.exam_type || ''}
                    onChange={e => setEditForm(f => ({ ...f, exam_type: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 outline-none bg-white"
                  >
                    <option value="">-- Chưa khám --</option>
                    <option value="Khám sức khỏe tổng quát">Khám sức khỏe tổng quát</option>
                    <option value="Khám sàng lọc bệnh">Khám sàng lọc bệnh</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Ngày khám</label>
                  <input type="date" value={editForm.exam_date || ''}
                    onChange={e => setEditForm(f => ({ ...f, exam_date: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Nơi khám</label>
                  <input type="text" value={editForm.exam_location || ''}
                    onChange={e => setEditForm(f => ({ ...f, exam_location: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Kết quả khám</label>
                  <textarea value={editForm.exam_result || ''}
                    onChange={e => setEditForm(f => ({ ...f, exam_result: e.target.value }))}
                    rows={3}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 flex items-center justify-between border-t border-slate-200">
              <button onClick={() => setEditRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm transition-colors">
                Huỷ
              </button>
              <button onClick={handleSaveEdit} disabled={editSaving}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-60">
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit2 className="w-4 h-4" />}
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trash Bin Modal */}
      {isTrashOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6 flex flex-col max-h-[85vh]">
            <div className="bg-amber-950 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-800/50 rounded-2xl border border-amber-600/30">
                  <Trash2 className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold uppercase">THÙNG RÁC HỆ THỐNG ({trashRecords.length})</h3>
                  <p className="text-amber-300 text-xs mt-0.5">Các hồ sơ bị tạm xóa. Bạn có thể khôi phục hoặc xóa vĩnh viễn.</p>
                </div>
              </div>
              <button
                onClick={() => setIsTrashOpen(false)}
                className="p-2 rounded-full hover:bg-amber-900 text-amber-300 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {trashRecords.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-medium">
                  <Trash2 className="w-12 h-12 mx-auto mb-3 text-slate-300 stroke-1" />
                  <p>Thùng rác trống. Không có hồ sơ nào bị tạm xóa.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-2">
                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Danh sách {trashRecords.length} hồ sơ trong thùng rác</span>
                    <button
                      onClick={handleEmptyTrash}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md"
                    >
                      <Flame className="w-4 h-4" />
                      Dọn Sạch Thùng Rác Vĩnh Viễn
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-200">
                    {trashRecords.map((r, idx) => (
                      <div key={r.citizen_id} className="p-4 bg-amber-50/40 hover:bg-amber-50 transition-colors flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="font-extrabold text-slate-900 uppercase">{r.full_name}</span>
                            <span className="font-mono text-xs text-sky-900 bg-sky-100 px-2 py-0.5 rounded font-bold">{r.cccd}</span>
                            <span className="text-xs text-slate-500">{formatDateVN(r.dob)} — {r.gender}</span>
                          </div>
                          <p className="text-xs text-slate-500">SĐT: {r.phone || '—'} | Đối tượng: {r.category}</p>
                          {r.deleted_at && <p className="text-[11px] text-amber-700 italic">Thời gian xóa: {new Date(r.deleted_at).toLocaleString('vi-VN')}</p>}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRestore(r.citizen_id!)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 transition-all"
                            title="Khôi phục về danh sách chính"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Khôi Phục
                          </button>

                          <button
                            onClick={() => handlePermanentDelete(r.citizen_id!, r.full_name || '')}
                            className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 transition-all"
                            title="Xóa thật sự khỏi cơ sở dữ liệu"
                          >
                            <Flame className="w-3.5 h-3.5" />
                            Xóa Vĩnh Viễn
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-100 p-4 flex justify-end border-t border-slate-200">
              <button
                onClick={() => setIsTrashOpen(false)}
                className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
