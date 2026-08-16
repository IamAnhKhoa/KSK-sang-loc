-- Database Schema for Health Examination Data Collection (KSK)
-- Compatible with Cloudflare D1 (SQLite)

CREATE TABLE IF NOT EXISTS citizens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cccd TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    dob TEXT,
    gender TEXT,
    ethnicity TEXT DEFAULT 'Kinh',
    blood_type TEXT,
    bhyt TEXT,
    current_address TEXT,
    ward TEXT,
    job TEXT,
    workplace TEXT,
    guardian_name TEXT,
    phone TEXT,
    category TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_citizens_cccd ON citizens(cccd);
CREATE INDEX IF NOT EXISTS idx_citizens_phone ON citizens(phone);
CREATE INDEX IF NOT EXISTS idx_citizens_name ON citizens(full_name);

CREATE TABLE IF NOT EXISTS health_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    citizen_id INTEGER NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
    cccd TEXT NOT NULL,
    exam_type TEXT NOT NULL, -- 'Khám sức khỏe tổng quát' OR 'Khám sàng lọc bệnh'
    screening_details TEXT, -- JSON array of selected options e.g. ["Ung thư cổ tử cung", "Ung thư vú"]
    screening_other TEXT,
    exam_date TEXT NOT NULL,
    exam_location TEXT NOT NULL,
    exam_result TEXT,
    attachment_id TEXT,
    idempotency_key TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_records_cccd ON health_records(cccd);
CREATE INDEX IF NOT EXISTS idx_records_exam_date ON health_records(exam_date);
CREATE INDEX IF NOT EXISTS idx_records_exam_type ON health_records(exam_type);

CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    data_base64 TEXT NOT NULL,
    file_size INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    target_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial admin check
CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
