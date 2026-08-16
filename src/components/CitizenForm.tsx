import React, { useState, useEffect } from 'react';
import { 
  QrCode, Search, User, Stethoscope, CheckCircle2, 
  ArrowRight, ArrowLeft, Upload, Trash2, 
  AlertCircle, RefreshCw, Loader2, MapPin
} from 'lucide-react';
import { FormDataState } from '../types';
import { parseVietnameseAddress } from '../utils/qrParser';
import { convertOldAddressToNew } from '../utils/addressMapper';
import { SearchableSelect } from './SearchableSelect';
import { SYT_ETHNICITIES, SYT_WARDS, SYT_OCCUPATIONS, SYT_WORKPLACES, SYT_EXAM_LOCATIONS } from '../data/formCatalogs';
import { validateCCCD } from '../utils/cccdValidator';
import { HeaderInfoBanner } from './HeaderInfoBanner';

interface CitizenFormProps {
  onOpenQR: () => void;
  onOpenLookup: () => void;
  scannedData: Partial<FormDataState> | null;
  clearScannedData: () => void;
  onNewRecord?: () => void;
}

const CATEGORIES = [
  'Trẻ đi học',
  'Trẻ không đi học',
  'Sinh viên, học viên',
  'Người lao động chính thức (theo Luật ATVSLĐ)',
  'Người lao động phi chính thức',
  'Người cao tuổi'
];

const SCREENING_OPTIONS = [
  'Ung thư cổ tử cung',
  'Ung thư vú',
  'Ung thư gan',
  'Ung thư đại trực tràng',
  'Ung thư tiền liệt tuyến',
  'Khác'
];

const INITIAL_FORM: FormDataState = {
  cccd: '',
  full_name: '',
  dob: '',
  gender: 'Nam',
  ethnicity: 'Kinh',
  blood_type: '',
  bhyt: '',
  current_address: '',
  ward: 'Xã Tân An Hội',
  city: 'Thành Phố Hồ Chí Minh',
  old_address_note: '',
  job: '',
  workplace: '',
  guardian_name: '',
  phone: '',
  category: 'Người lao động chính thức (theo Luật ATVSLĐ)',
  exam_type: 'Khám sức khỏe tổng quát',
  screening_details: [],
  screening_other: '',
  exam_date: '',
  exam_location: '',
  exam_result: '',
  attachment_id: '',
  attachment_preview: ''
};

// Calculate age from dob string (dd/MM/yyyy or YYYY-MM-DD)
const calcAge = (dob: string): number => {
  if (!dob) return 99;
  let birth: Date;
  if (dob.includes('/')) {
    const p = dob.split('/');
    birth = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
  } else {
    birth = new Date(dob);
  }
  if (isNaN(birth.getTime())) return 99;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age--;
  return age;
};

// Format YYYY-MM-DD → dd/MM/yyyy
const isoToDmy = (iso: string): string => {
  if (!iso || !iso.includes('-')) return iso;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

// Parse ward from QR address string like "Tân Thạnh Tây, Củ Chi, TP. Hồ Chí Minh"
const parseWardFromAddress = (address: string): string => {
  if (!address) return 'Xã Tân An Hội';
  const first = address.split(',')[0]?.trim();
  return first ? first : 'Xã Tân An Hội';
};

/**
 * Auto-classify citizen category based on age:
 * 0-5    → Trẻ không đi học
 * 6-17   → Trẻ đi học
 * 18-22  → Sinh viên, học viên
 * 18-59  → Người lao động chính thức (theo Luật ATVSLĐ)
 * ≥60    → Người cao tuổi
 */
const getCategoryByAge = (dob: string): string => {
  const age = calcAge(dob);
  if (age < 0) return 'Người lao động chính thức (theo Luật ATVSLĐ)';
  if (age <= 5)  return 'Trẻ không đi học';
  if (age <= 17) return 'Trẻ đi học';
  if (age <= 22) return 'Sinh viên, học viên';
  if (age <= 59) return 'Người lao động chính thức (theo Luật ATVSLĐ)';
  return 'Người cao tuổi';
};

const CATEGORY_AGE_HINTS: Record<string, string> = {
  'Trẻ không đi học':                              '0–5 tuổi',
  'Trẻ đi học':                                    '6–17 tuổi',
  'Sinh viên, học viên':                           '18–22 tuổi',
  'Người lao động chính thức (theo Luật ATVSLĐ)': '18–59 tuổi',
  'Người lao động phi chính thức':                 '18–59 tuổi',
  'Người cao tuổi':                                'Từ 60 tuổi',
};

const DRAFT_KEY = 'ksk_form_draft_v1';

export const CitizenForm: React.FC<CitizenFormProps> = ({
  onOpenQR,
  onOpenLookup,
  scannedData,
  clearScannedData,
  onNewRecord
}) => {
  const [step, setStep] = useState<number>(1);
  const [formData, setFormData] = useState<FormDataState>(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return INITIAL_FORM;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submittedRecordId, setSubmittedRecordId] = useState<number | null>(null);
  // Track whether user manually overrode the auto category
  const [categoryAutoSet, setCategoryAutoSet] = useState(false);

  // Auto-save draft on form change
  useEffect(() => {
    if (!submitSuccess) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    }
  }, [formData, submitSuccess]);

  // Auto-set category whenever DOB changes — always follow age
  useEffect(() => {
    if (formData.dob) {
      const suggested = getCategoryByAge(formData.dob);
      setFormData((prev) => ({ ...prev, category: suggested }));
    }
  }, [formData.dob]);

  // Handle auto-fill when QR is scanned — parse address into correct fields & convert old address to new
  useEffect(() => {
    if (scannedData) {
      setErrors({});
      setFormData((prev) => {
        const isNewPerson = scannedData.cccd && scannedData.cccd !== prev.cccd;
        const rawAddress = scannedData.current_address || scannedData.ward || prev.current_address || '';
        const addressConverted = convertOldAddressToNew(rawAddress);
        const dobConverted = scannedData.dob ? isoToDmy(scannedData.dob) : prev.dob;
        return {
          ...prev,
          ...scannedData,
          dob: dobConverted,
          current_address: addressConverted.current_address || scannedData.current_address || prev.current_address || '',
          ward: (addressConverted.ward && addressConverted.ward !== 'Xã Tân An Hội')
            ? addressConverted.ward
            : (scannedData.ward || addressConverted.ward || 'Xã Tân An Hội'),
          city: addressConverted.city || prev.city || 'Thành Phố Hồ Chí Minh',
          old_address_note: addressConverted.old_address_note || '',
          workplace: prev.workplace || '',
          // Reset per-person fields when new CCCD scanned
          phone: scannedData.phone || (isNewPerson ? '' : prev.phone),
          exam_date: scannedData.exam_date || (isNewPerson ? '' : prev.exam_date),
          exam_location: scannedData.exam_location || (isNewPerson ? '' : prev.exam_location),
          exam_result: scannedData.exam_result || (isNewPerson ? '' : prev.exam_result),
          attachment_id: scannedData.attachment_id || (isNewPerson ? '' : prev.attachment_id),
          attachment_preview: scannedData.attachment_preview || (isNewPerson ? '' : prev.attachment_preview),
        };
      });
      clearScannedData();
    }
  }, [scannedData]);

  const handleChange = (field: keyof FormDataState, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Date input handler: auto-format as dd/MM/yyyy
  const handleDateChange = (field: 'dob' | 'exam_date', raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let v = digits;
    if (digits.length > 2) v = digits.slice(0, 2) + '/' + digits.slice(2);
    if (digits.length > 4) v = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
    handleChange(field, v);
  };

  const handleScreeningToggle = (option: string) => {
    setFormData((prev) => {
      const current = prev.screening_details || [];
      const updated = current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option];
      return { ...prev, screening_details: updated };
    });
  };

  // Image Upload with Browser Compress (WebP < 500KB)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);

        // Upload compressed image to backend
        fetch('/api/attachments/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            mime_type: 'image/jpeg',
            data_base64: compressedBase64
          })
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              setFormData((prev) => ({
                ...prev,
                attachment_id: data.id,
                attachment_preview: compressedBase64
              }));
            } else {
              alert('Lỗi tải ảnh: ' + (data.error || 'Không thể lưu ảnh'));
            }
          })
          .catch((err) => {
            alert('Lỗi tải ảnh: ' + err.message);
          })
          .finally(() => {
            setUploadingImage(false);
          });
      };
    };

    reader.readAsDataURL(file);
  };

  // Tự động cuộn & Focus vào ô còn thiếu thông tin
  const focusFirstError = (errObj: Record<string, string>) => {
    const errorFields = Object.keys(errObj);
    if (errorFields.length === 0) return;

    const priority = [
      'cccd', 
      'full_name', 
      'dob', 
      'phone', 
      'guardian_name', 
      'category', 
      'exam_type', 
      'screening_details', 
      'exam_date', 
      'exam_location'
    ];
    const firstField = priority.find((f) => errorFields.includes(f)) || errorFields[0];

    setTimeout(() => {
      const el = document.getElementById(`field-${firstField}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const inputInside = el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' 
          ? el 
          : el.querySelector('input, select, textarea');

        if (inputInside && 'focus' in inputInside && typeof (inputInside as any).focus === 'function') {
          (inputInside as HTMLElement).focus();
        }

        // Tạo hiệu ứng nháy đỏ cảnh báo
        el.classList.add('ring-4', 'ring-red-400', 'border-red-500', 'bg-red-50/80');
        setTimeout(() => {
          el.classList.remove('ring-4', 'ring-red-400', 'bg-red-50/80');
        }, 3500);
      }
    }, 100);
  };

  // Step Validations — 2 steps
  const validateStep = (currentStep: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (currentStep === 1) {
      const cccdClean = (formData.cccd || '').trim();
      const cccdValidation = validateCCCD(cccdClean);
      if (!cccdValidation.valid) {
        newErrors.cccd = cccdValidation.errors[0];
      }

      const nameClean = (formData.full_name || '').trim();
      if (!nameClean) {
        newErrors.full_name = 'Vui lòng nhập Họ và tên người dân';
      }

      const dobClean = (formData.dob || '').trim();
      if (!dobClean) {
        newErrors.dob = 'Vui lòng nhập ngày sinh (dd/MM/yyyy)';
      } else if (dobClean.length < 4) {
        newErrors.dob = 'Ngày sinh chưa đủ định dạng (VD: 15/08/1990 hoặc 1990)';
      }

      const phoneClean = (formData.phone || '').replace(/\D/g, '');
      if (!phoneClean || phoneClean.length < 9 || phoneClean.length > 11) {
        newErrors.phone = 'Vui lòng nhập số điện thoại di động hợp lệ (9 - 11 chữ số)';
      }

      if (calcAge(formData.dob) <= 16 && (!formData.guardian_name || formData.guardian_name.trim().length === 0)) {
        newErrors.guardian_name = 'Vui lòng nhập Họ tên mẹ hoặc người giám hộ';
      }

      if (!formData.job || formData.job.trim().length === 0) {
        newErrors.job = 'Vui lòng chọn nghề nghiệp';
      }

      if (!formData.workplace || formData.workplace.trim().length === 0) {
        newErrors.workplace = 'Vui lòng chọn nơi làm việc, học tập';
      }

      if (!formData.category) {
        newErrors.category = 'Vui lòng chọn nhóm đối tượng người dân';
      }
    }

    if (currentStep === 2) {
      if (!formData.exam_type) {
        newErrors.exam_type = 'Vui lòng chọn hình thức khám';
      }
      if (formData.exam_type === 'Khám sàng lọc bệnh' && (!formData.screening_details || formData.screening_details.length === 0)) {
        newErrors.screening_details = 'Vui lòng chọn ít nhất 1 loại bệnh sàng lọc';
      }
      if (!formData.exam_date) {
        newErrors.exam_date = 'Vui lòng nhập ngày khám (dd/MM/yyyy)';
      }
      if (!formData.exam_location || formData.exam_location.trim().length === 0) {
        newErrors.exam_location = 'Vui lòng nhập nơi khám';
      }
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      focusFirstError(newErrors);
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      if (step === 1) {
        // Tự động đồng bộ & lưu thông tin cá nhân + SĐT vào CSDL ngay khi nhấn Tiếp theo
        fetch('/api/citizens/autocreate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cccd: formData.cccd,
            full_name: formData.full_name,
            dob: formData.dob,
            gender: formData.gender,
            ethnicity: formData.ethnicity,
            blood_type: formData.blood_type,
            bhyt: formData.bhyt,
            current_address: formData.current_address,
            ward: formData.ward,
            old_address_note: formData.old_address_note,
            job: formData.job,
            workplace: formData.workplace,
            guardian_name: formData.guardian_name,
            phone: formData.phone,
            category: formData.category
          })
        }).catch((err) => console.warn('Background sync error:', err));
      }

      setStep((prev) => Math.min(prev + 1, 2));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    setStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit Final Form to Backend
  const handleSubmit = async () => {
    if (step === 1) {
      handleNext();
      return;
    }

    if (!validateStep(1)) {
      setStep(1);
      return;
    }

    if (!validateStep(2)) {
      return;
    }

    setIsSubmitting(true);
    const idempotencyKey = 'idemp_' + formData.cccd + '_' + formData.exam_date + '_' + Date.now();

    try {
      const res = await fetch('/api/records/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          idempotency_key: idempotencyKey
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Lỗi lưu thông tin');
      }

      setSubmittedRecordId(data.record_id);
      setSubmitSuccess(true);
      localStorage.removeItem(DRAFT_KEY);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      alert('Lỗi gửi hồ sơ: ' + (err.message || 'Không thể kết nối server'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData(INITIAL_FORM);
    setStep(1);
    setSubmitSuccess(false);
    setSubmittedRecordId(null);
    setErrors({});
    localStorage.removeItem(DRAFT_KEY);
  };

  const handleNewRecord = () => {
    resetForm();
    if (onNewRecord) {
      onNewRecord();
    } else {
      clearScannedData();
      onOpenQR();
    }
  };

  if (submitSuccess) {
    return (
      <div className="max-w-3xl mx-auto my-8 p-4">
        <div className="glass-card text-center space-y-6 animate-fade-in border-2 border-emerald-200">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
            <CheckCircle2 className="w-12 h-12" />
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold text-slate-900">
              GHI NHẬN HỒ SƠ THÀNH CÔNG!
            </h2>
            <p className="text-lg text-slate-600 font-medium">
              Thông tin sức khỏe của ông/bà <strong className="text-slate-900">{formData.full_name}</strong> (CCCD: {formData.cccd}) đã được ghi nhận an toàn vào hệ thống.
            </p>
            {submittedRecordId && (
              <p className="text-sm font-semibold text-sky-700 bg-sky-50 py-2 px-4 rounded-xl inline-block">
                Mã bản ghi hệ thống: #{submittedRecordId}
              </p>
            )}
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleNewRecord}
              className="senior-btn-primary py-4 px-8 text-xl"
            >
              <QrCode className="w-6 h-6" />
              <span>Ghi Nhận Hồ Sơ Mới (Quét QR CCCD)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto my-3 sm:my-6 px-3 sm:px-4 pb-12">
      <div className="mb-4 sm:mb-6 hidden md:block">
        <HeaderInfoBanner onOpenQR={onOpenQR} onOpenLookup={onOpenLookup} />
      </div>

      {/* Step Progress — 2 bước */}
      <div className="mb-4 sm:mb-6 bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-sm sm:text-base font-extrabold text-sky-700">Bước {step}/2</span>
          <span className="text-xs sm:text-sm font-bold text-slate-500">
            {step === 1 ? 'Thông tin cá nhân' : 'Thông tin khám & Gửi'}
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-600 rounded-full transition-all duration-300"
            style={{ width: `${(step / 2) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-around relative px-1 mt-3">
          {[
            { num: 1, label: 'Thông tin cá nhân', icon: User },
            { num: 2, label: 'Thông tin khám & Gửi', icon: Stethoscope },
          ].map((s) => {
            const Icon = s.icon;
            const active = step === s.num;
            const completed = step > s.num;
            return (
              <div
                key={s.num}
                onClick={() => { if (completed) setStep(s.num); }}
                className="flex flex-col items-center gap-1 cursor-pointer select-none"
              >
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold transition-all border-2 ${
                  completed ? 'bg-sky-600 text-white border-sky-600'
                  : active ? 'bg-white text-sky-600 border-sky-600 ring-4 ring-sky-100'
                  : 'bg-white text-slate-400 border-slate-300'
                }`}>
                  {completed ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Icon className="w-4 h-4 sm:w-5 sm:h-5" />}
                </div>
                <span className={`text-[11px] sm:text-xs font-bold ${active ? 'text-sky-700' : 'text-slate-500'}`}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Form Container */}
      <form onSubmit={(e) => e.preventDefault()} className="glass-card">
        {/* STEP 1: HÀNH CHÍNH */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div className="border-b border-slate-200 pb-3 sm:pb-4">
              <h3 className="text-base sm:text-2xl font-black text-slate-900 flex items-center gap-2 sm:gap-3 leading-snug">
                <User className="w-5 h-5 sm:w-7 sm:h-7 text-sky-600 shrink-0" />
                <span>BƯỚC 1: THÔNG TIN CÁ NHÂN &amp; LIÊN HỆ</span>
              </h3>
              <p className="text-slate-500 text-xs sm:text-base mt-0.5">Điền thông tin định danh, nơi ở và nhóm đối tượng</p>
            </div>

            {Object.keys(errors).length > 0 && (
              <div className="p-4 bg-red-50 border-2 border-red-300 rounded-2xl flex items-center justify-between gap-3 text-red-800 font-extrabold text-sm animate-pulse shadow-md">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                  <span>Hệ thống phát hiện {Object.keys(errors).length} thông tin còn thiếu. Đã tự động chuyển đến vị trí cần điền!</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-5">
              {/* Số CCCD */}
              <div>
                <label className="senior-label">
                  Số CCCD / Mã số định danh <span className="text-red-500">*</span>
                </label>
                <input
                  id="field-cccd"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.cccd}
                  onChange={(e) => handleChange('cccd', e.target.value.replace(/\D/g, '').slice(0, 12))}
                  placeholder="Nhập đúng 12 chữ số CCCD"
                  className={`senior-input font-mono tracking-wider transition-all ${errors.cccd ? 'border-red-500 bg-red-50/70 ring-4 ring-red-300' : ''}`}
                  maxLength={12}
                />
                {/* Live parse preview */}
                {formData.cccd.length === 12 && (() => {
                  const r = validateCCCD(formData.cccd);
                  return r.valid ? (
                    <p className="mt-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                      {r.provinceName} · {r.gender} · Năm sinh {r.birthYear}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {r.errors[0]}
                    </p>
                  );
                })()}
                {errors.cccd && (
                  <p className="mt-1 text-sm font-bold text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> {errors.cccd}
                  </p>
                )}
              </div>

              {/* Họ và tên */}
              <div>
                <label className="senior-label">
                  Họ và tên (viết chữ in hoa) <span className="text-red-500">*</span>
                </label>
                <input
                  id="field-full_name"
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => handleChange('full_name', e.target.value.toUpperCase())}
                  placeholder="VD: NGUYỄN VĂN A"
                  className={`senior-input uppercase transition-all ${errors.full_name ? 'border-red-500 bg-red-50/70 ring-4 ring-red-300' : ''}`}
                />
                {errors.full_name && (
                  <p className="mt-1 text-sm font-bold text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> {errors.full_name}
                  </p>
                )}
              </div>

              {/* Ngày tháng năm sinh */}
              <div>
                <label className="senior-label">
                  Ngày tháng năm sinh <span className="text-red-500">*</span>
                </label>
                <input
                  id="field-dob"
                  type="text"
                  inputMode="numeric"
                  value={formData.dob}
                  onChange={(e) => handleDateChange('dob', e.target.value)}
                  placeholder="dd/MM/yyyy (VD: 15/08/1990)"
                  className={`senior-input font-mono transition-all ${errors.dob ? 'border-red-500 bg-red-50/70 ring-4 ring-red-300' : ''}`}
                  maxLength={10}
                />
                {errors.dob && (
                  <p className="mt-1 text-sm font-bold text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> {errors.dob}
                  </p>
                )}
              </div>

              {/* Giới tính */}
              <div>
                <label className="senior-label">Giới tính</label>
                <div className="flex gap-4">
                  {['Nam', 'Nữ'].map((g) => (
                    <label 
                      key={g}
                      className={`flex-1 border-2 rounded-xl p-3.5 flex items-center justify-center gap-3 cursor-pointer font-bold text-lg transition-all ${
                        formData.gender === g
                          ? 'border-sky-600 bg-sky-50 text-sky-800'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="gender"
                        value={g}
                        checked={formData.gender === g}
                        onChange={() => handleChange('gender', g)}
                        className="w-5 h-5 text-sky-600"
                      />
                      <span>{g}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Dân tộc */}
              <SearchableSelect
                label="Dân tộc"
                value={formData.ethnicity}
                onChange={(val) => handleChange('ethnicity', val)}
                options={SYT_ETHNICITIES}
                placeholder="Gõ để tìm dân tộc (Kinh, Hoa, Khmer...)"
              />

              {/* Nhóm máu */}
              <div>
                <label className="senior-label">Nhóm máu (nếu có)</label>
                <select
                  value={formData.blood_type}
                  onChange={(e) => handleChange('blood_type', e.target.value)}
                  className="senior-input"
                >
                  <option value="">Chưa xác định</option>
                  <option value="A">Nhóm máu A</option>
                  <option value="B">Nhóm máu B</option>
                  <option value="AB">Nhóm máu AB</option>
                  <option value="O">Nhóm máu O</option>
                </select>
              </div>

              {/* Số thẻ BHYT */}
              <div>
                <label className="senior-label">Số thẻ BHYT (nếu có)</label>
                <input
                  type="text"
                  value={formData.bhyt}
                  onChange={(e) => handleChange('bhyt', e.target.value.toUpperCase())}
                  placeholder="Nhập 15 ký tự mã thẻ BHYT (nếu có)"
                  className="senior-input uppercase"
                  maxLength={15}
                />
              </div>

              {/* Nơi ở hiện tại */}
              <div>
                <label className="senior-label">Nơi ở hiện tại (Số nhà, Đường/Ấp)</label>
                <input
                  type="text"
                  value={formData.current_address}
                  onChange={(e) => handleChange('current_address', e.target.value)}
                  placeholder="VD: Số 20B Đường Số 24, Ấp 3A"
                  className="senior-input"
                />
              </div>

              {/* Xã, Phường — pre-filled from QR parse */}
              <div className="space-y-2">
                <SearchableSelect
                  label="Xã, Phường cư trú"
                  value={formData.ward}
                  onChange={(val) => handleChange('ward', val)}
                  options={SYT_WARDS}
                  placeholder="Gõ để tìm xã/phường (VD: Xã Tân An Hội...)"
                />

                {/* Ô mờ riêng chỉ hiển thị khi quét QR CCCD có đơn vị cũ */}
                {formData.old_address_note && (
                  <div className="p-3 bg-slate-100/90 border border-slate-300/70 rounded-2xl flex items-center gap-2.5 text-slate-500 text-xs sm:text-sm font-medium animate-fade-in opacity-85 shadow-inner">
                    <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div>
                      <span className="font-bold text-slate-600 uppercase text-[11px] tracking-wider block">
                        ĐKHKTT gốc trên CCCD (Địa giới hành chính cũ):
                      </span>
                      <span className="font-semibold text-slate-700">{formData.old_address_note}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Điện thoại di động */}
              <div>
                <label className="senior-label">
                  Điện thoại di động <span className="text-red-500">*</span>
                </label>
                <input
                  id="field-phone"
                  type="tel"
                  inputMode="numeric"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value.replace(/\D/g, ''))}
                  placeholder="VD: 0912 345 678"
                  className={`senior-input transition-all ${errors.phone ? 'border-red-500 bg-red-50/70 ring-4 ring-red-300' : ''}`}
                  maxLength={11}
                />
                {errors.phone && (
                  <p className="mt-1.5 text-sm font-bold text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> {errors.phone}
                  </p>
                )}
              </div>

              {/* Nghề nghiệp — bắt buộc */}
              <div id="field-job">
                <SearchableSelect
                  label={<>Nghề nghiệp <span className="text-red-500">*</span></>}
                  value={formData.job}
                  onChange={(val) => handleChange('job', val)}
                  options={(SYT_OCCUPATIONS as (string | number)[]).filter((o): o is string => typeof o === 'string')}
                  placeholder="Gõ để tìm nghề nghiệp..."
                  hasError={!!errors.job}
                />
                {errors.job && (
                  <p className="mt-1 text-sm font-bold text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> {errors.job}
                  </p>
                )}
              </div>

              {/* Nơi làm việc — bắt buộc, không điền sẵn */}
              <div id="field-workplace">
                <SearchableSelect
                  label={<>Nơi làm việc, học tập (Xã/Phường/Trường/Đơn vị) <span className="text-red-500">*</span></>}
                  value={formData.workplace}
                  onChange={(val) => handleChange('workplace', val)}
                  options={SYT_WORKPLACES}
                  placeholder="Gõ để tìm nơi làm việc..."
                  hasError={!!errors.workplace}
                />
                {errors.workplace && (
                  <p className="mt-1 text-sm font-bold text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> {errors.workplace}
                  </p>
                )}
              </div>

              {/* Guardian — only show if age ≤ 16 */}
              {calcAge(formData.dob) <= 16 && (
                <div className={`p-4 rounded-2xl border-2 transition-all ${errors.guardian_name ? 'border-red-500 bg-red-50/70 ring-4 ring-red-300' : 'bg-amber-50 border-amber-200'}`}>
                  <label className="senior-label text-amber-900">
                    Họ tên mẹ hoặc người giám hộ <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-amber-700 font-semibold mb-2">Bắt buộc với trẻ từ 16 tuổi trở xuống</p>
                  <input
                    id="field-guardian_name"
                    type="text"
                    value={formData.guardian_name}
                    onChange={(e) => handleChange('guardian_name', e.target.value)}
                    placeholder="Nhập họ tên cha/mẹ hoặc người giám hộ"
                    className="senior-input bg-white"
                  />
                  {errors.guardian_name && (
                    <p className="mt-1.5 text-sm font-bold text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> {errors.guardian_name}
                    </p>
                  )}
                </div>
              )}

              {/* Đối tượng — auto-suggested by age, manually overridable */}
              <div id="field-category" className={`p-3.5 rounded-2xl border-2 transition-all ${errors.category ? 'border-red-500 bg-red-50/70 ring-4 ring-red-300' : 'border-transparent'}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <label className="senior-label mb-0">
                    Nhóm đối tượng người dân <span className="text-red-500">*</span>
                  </label>
                  {formData.dob && (
                    <span className="flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full bg-sky-100 text-sky-700 border border-sky-200 whitespace-nowrap">
                      {calcAge(formData.dob)} tuổi
                    </span>
                  )}
                </div>

                {formData.dob && (
                  <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                    <span className="text-emerald-600" style={{ fontSize: '18px' }}>✓</span>
                    <span className="text-emerald-800 font-semibold" style={{ fontSize: '14px' }}>
                      Tự động phân loại: <strong>{getCategoryByAge(formData.dob)}</strong>
                    </span>
                    <span className="text-emerald-600 font-medium ml-auto" style={{ fontSize: '12px' }}>Theo tuổi</span>
                  </div>
                )}

                {errors.category && (
                  <p className="mb-2 text-sm font-bold text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> {errors.category}
                  </p>
                )}

                <div className="grid grid-cols-1 gap-2.5">
                  {CATEGORIES.map((cat) => {
                    const isSelected = formData.category === cat;
                    return (
                      <label
                        key={cat}
                        className={`border-2 rounded-xl px-4 flex items-center gap-3 cursor-pointer font-semibold transition-all ${
                          isSelected
                            ? 'border-sky-600 bg-sky-50 text-sky-900'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                        style={{ fontSize: '16px', minHeight: '52px', touchAction: 'manipulation' }}
                      >
                        <input
                          type="radio"
                          name="category"
                          value={cat}
                          checked={isSelected}
                          onChange={() => handleChange('category', cat)}
                          className="w-5 h-5 flex-shrink-0"
                          style={{ accentColor: '#0284c7' }}
                        />
                        <span className="flex-1">{cat}</span>
                        <span className="text-xs font-medium text-slate-400 flex-shrink-0">
                          {CATEGORY_AGE_HINTS[cat]}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: THÔNG TIN KHÁM SỨC KHỎE */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div className="border-b border-slate-200 pb-3 sm:pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-2xl font-black text-slate-900 flex items-center gap-2 sm:gap-3 leading-snug">
                    <Stethoscope className="w-5 h-5 sm:w-7 sm:h-7 text-sky-600 shrink-0" />
                    <span>BƯỚC 2: THÔNG TIN KHÁM SỨC KHỎE / SÀNG LỌC</span>
                  </h3>
                  <p className="text-slate-500 text-xs sm:text-base mt-0.5">Nội dung phiếu khám và kết quả kết luận</p>
                </div>
                {formData.attachment_id || formData.exam_date ? (
                  <div className="shrink-0 flex items-center justify-between sm:block text-left sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <span className="text-xs text-slate-500 font-semibold">Hồ sơ cũ đã nạp</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          exam_type: 'Khám sức khỏe tổng quát',
                          screening_details: [],
                          screening_other: '',
                          exam_date: '',
                          exam_location: '',
                          exam_result: '',
                          attachment_id: '',
                          attachment_preview: ''
                        }));
                      }}
                      className="sm:mt-1 text-xs font-extrabold text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl hover:bg-red-100 transition-colors"
                    >
                      🗑 Xóa – Ghi nhận hồ sơ mới
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {Object.keys(errors).length > 0 && (
              <div className="p-4 bg-red-50 border-2 border-red-300 rounded-2xl flex items-center justify-between gap-3 text-red-800 font-extrabold text-sm animate-pulse shadow-md">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                  <span>Hệ thống phát hiện {Object.keys(errors).length} thông tin còn thiếu. Đã tự động chuyển đến vị trí cần điền!</span>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* Hình thức khám */}
              <div id="field-exam_type" className={`p-4 rounded-2xl border-2 transition-all ${errors.exam_type ? 'border-red-500 bg-red-50/70 ring-4 ring-red-300' : 'border-transparent'}`}>
                <label className="senior-label">
                  Hình thức khám <span className="text-red-500">*</span>
                </label>
                {errors.exam_type && (
                  <p className="mb-2 text-sm font-bold text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> {errors.exam_type}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    'Khám sức khỏe tổng quát',
                    'Khám sàng lọc bệnh'
                  ].map((type) => (
                    <label
                      key={type}
                      className={`border-2 rounded-2xl p-4 flex items-center gap-4 cursor-pointer font-bold text-lg transition-all ${
                        formData.exam_type === type
                          ? 'border-sky-600 bg-sky-50 text-sky-900 shadow-md'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="exam_type"
                        value={type}
                        checked={formData.exam_type === type}
                        onChange={() => handleChange('exam_type', type)}
                        className="w-6 h-6 text-sky-600"
                      />
                      <span>{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Options list for Khám sàng lọc bệnh */}
              {formData.exam_type === 'Khám sàng lọc bệnh' && (
                <div id="field-screening_details" className={`p-5 rounded-2xl border-2 space-y-4 transition-all ${errors.screening_details ? 'border-red-500 bg-red-50/70 ring-4 ring-red-300' : 'bg-sky-50/80 border-sky-200'}`}>
                  <label className="senior-label text-sky-900">
                    Chọn loại bệnh khám sàng lọc: <span className="text-red-500">*</span>
                  </label>
                  {errors.screening_details && (
                    <p className="text-sm font-bold text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> {errors.screening_details}
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SCREENING_OPTIONS.map((opt) => {
                      const checked = formData.screening_details.includes(opt);
                      return (
                        <label
                          key={opt}
                          className={`border-2 rounded-xl p-3.5 flex items-center gap-3 cursor-pointer font-medium text-base transition-all ${
                            checked
                              ? 'border-sky-600 bg-white text-sky-900 shadow-sm'
                              : 'border-slate-300 bg-white/80 text-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleScreeningToggle(opt)}
                            className="w-5 h-5 text-sky-600 rounded"
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>

                  {formData.screening_details.includes('Khác') && (
                    <div className="pt-2">
                      <label className="senior-label text-sm">Ghi rõ bệnh sàng lọc khác:</label>
                      <input
                        type="text"
                        value={formData.screening_other}
                        onChange={(e) => handleChange('screening_other', e.target.value)}
                        placeholder="Nhập tên bệnh sàng lọc khác..."
                        className="senior-input bg-white"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Ngày khám & Nơi khám */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="senior-label">
                    Ngày khám <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="field-exam_date"
                    type="text"
                    inputMode="numeric"
                    value={formData.exam_date}
                    onChange={(e) => handleDateChange('exam_date', e.target.value)}
                    placeholder="dd/MM/yyyy"
                    className={`senior-input font-mono transition-all ${errors.exam_date ? 'border-red-500 bg-red-50/70 ring-4 ring-red-300' : ''}`}
                    maxLength={10}
                  />
                  {errors.exam_date && (
                    <p className="mt-1.5 text-sm font-bold text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> {errors.exam_date}
                    </p>
                  )}
                </div>

                <div id="field-exam_location" className={`rounded-2xl transition-all ${errors.exam_location ? 'ring-4 ring-red-300 border-red-500' : ''}`}>
                  <SearchableSelect
                    label="Nơi khám"
                    value={formData.exam_location}
                    onChange={(val) => handleChange('exam_location', val)}
                    options={SYT_EXAM_LOCATIONS}
                    placeholder="Gõ để tìm nơi khám (VD: Trạm Y tế Xã Tân An Hội...)"
                    required
                  />
                  {errors.exam_location && (
                    <p className="mt-1.5 text-sm font-bold text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> {errors.exam_location}
                    </p>
                  )}
                </div>
              </div>

              {/* Kết quả khám */}
              <div>
                <label className="senior-label">
                  Kết quả khám / Kết luận của bác sĩ (nếu có)
                </label>
                <textarea
                  rows={3}
                  value={formData.exam_result}
                  onChange={(e) => handleChange('exam_result', e.target.value)}
                  placeholder="Ghi theo kết luận của phiếu khám sức khỏe / phiếu khám sàng lọc..."
                  className="senior-input py-3"
                ></textarea>
              </div>

              {/* Upload ảnh/file kết quả */}
              <div className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-300 text-center">
                <label className="senior-label mb-2">Tải lên ảnh phiếu khám / kết quả (Không bắt buộc)</label>
                <p className="text-xs text-slate-500 mb-4">
                  Ảnh được tự động nén tối ưu dung lượng trước khi lưu.
                </p>

                {(() => {
                  const attachmentSrc = formData.attachment_preview || (formData.attachment_id ? `/api/attachments/${formData.attachment_id}` : null);
                  return attachmentSrc ? (
                    <div className="relative inline-block max-w-xs mx-auto rounded-2xl overflow-hidden shadow-lg border border-slate-200 group">
                      <img
                        src={attachmentSrc}
                        alt="Ảnh phiếu khám"
                        className="w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(attachmentSrc, '_blank')}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-slate-900/60 text-white text-[11px] font-bold py-1 text-center">
                        Nhấp để xem ảnh phóng to
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          handleChange('attachment_preview', '');
                          handleChange('attachment_id', '');
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full shadow hover:bg-red-700 transition-colors"
                        title="Xóa ảnh"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <label className="inline-flex items-center gap-3 bg-white border-2 border-slate-300 hover:border-sky-500 text-slate-700 font-bold px-6 py-3.5 rounded-2xl cursor-pointer shadow-sm hover:shadow transition-all">
                      {uploadingImage ? (
                        <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
                      ) : (
                        <Upload className="w-6 h-6 text-sky-600" />
                      )}
                      <span>{uploadingImage ? 'Đang nén & Tải ảnh...' : 'Chọn ảnh từ thiết bị / Đổ camera'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                    </label>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Footer Step Controls */}
        <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-between gap-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={handlePrev}
              className="senior-btn-secondary max-w-[180px]"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Quay Lại</span>
            </button>
          ) : (
            <div></div>
          )}

          {step < 2 ? (
            <button
              type="button"
              onClick={handleNext}
              className="senior-btn-primary max-w-[240px]"
            >
              <span>Tiếp Theo</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="senior-btn-primary max-w-[320px] bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 border-emerald-500/30"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Đang gửi hồ sơ...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-6 h-6" />
                  <span>XÁC NHẬN GỬI HỒ SƠ</span>
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
