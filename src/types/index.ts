export interface Citizen {
  id?: number;
  cccd: string;
  full_name: string;
  dob: string;
  gender: string;
  ethnicity: string;
  blood_type?: string;
  bhyt?: string;
  current_address?: string;
  ward?: string;
  city?: string;
  old_address_note?: string;
  job?: string;
  workplace?: string;
  guardian_name?: string;
  phone?: string;
  category: string;
  created_at?: string;
  updated_at?: string;
}

export interface HealthRecord {
  record_id?: number;
  id?: number;
  citizen_id?: number;
  cccd: string;
  exam_type: string; // 'Khám sức khỏe tổng quát' | 'Khám sàng lọc bệnh'
  screening_details?: string | string[];
  screening_other?: string;
  exam_date: string;
  exam_location: string;
  exam_result?: string;
  attachment_id?: string;
  created_at?: string;
  record_created_at?: string;
  deleted_at?: string;

  // Joined citizen fields
  full_name?: string;
  dob?: string;
  gender?: string;
  ethnicity?: string;
  blood_type?: string;
  bhyt?: string;
  current_address?: string;
  ward?: string;
  city?: string;
  old_address_note?: string;
  job?: string;
  workplace?: string;
  guardian_name?: string;
  phone?: string;
  category?: string;
}

export interface FormDataState {
  cccd: string;
  full_name: string;
  dob: string;
  gender: string;
  ethnicity: string;
  blood_type: string;
  bhyt: string;
  current_address: string;
  ward: string;
  city?: string;
  old_address_note?: string;
  job: string;
  workplace: string;
  guardian_name: string;
  phone: string;
  category: string;
  exam_type: string;
  screening_details: string[];
  screening_other: string;
  exam_date: string;
  exam_location: string;
  exam_result: string;
  attachment_id: string;
  attachment_preview: string;
}

export interface StatsData {
  totalCitizens: number;
  totalRecords: number;
  byCategory: Array<{ category: string; count: number }>;
  byExamType: Array<{ exam_type: string; count: number }>;
  byWard: Array<{ ward: string; count: number }>;
}
