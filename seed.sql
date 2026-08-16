-- Seed sample citizens and health records for testing

INSERT OR IGNORE INTO citizens (cccd, full_name, dob, gender, ethnicity, blood_type, bhyt, current_address, ward, job, workplace, guardian_name, phone, category) 
VALUES 
('079201012345', 'NGUYỄN VĂN AN', '1958-05-12', 'Nam', 'Kinh', 'O', 'GD47901012345', '123 Đường Tân Tiến, Ấp 1', 'Xã Tân An Hội', 'Hưu trí', 'Xã Tân An Hội', '', '0903123456', 'Người cao tuổi'),
('079192087654', 'TRAN THI MAI', '1982-11-25', 'Nữ', 'Kinh', 'A', 'DN47908765432', '456 Ấp Bến Đò', 'Xã Tân An Hội', 'Buôn bán', 'Chợ Củ Chi', '', '0918765432', 'Người lao động phi chính thức'),
('079305099887', 'LE HOANG NAM', '2012-08-14', 'Nam', 'Kinh', 'B', 'HS47909988776', '789 Đường Tỉnh lộ 8', 'Xã Tân An Hội', 'Học sinh', 'Trường THCS Tân An Hội', 'Lê Văn Hùng', '0987654321', 'Trẻ đi học');

INSERT OR IGNORE INTO health_records (citizen_id, cccd, exam_type, screening_details, screening_other, exam_date, exam_location, exam_result, idempotency_key)
VALUES 
(1, '079201012345', 'Khám sức khỏe tổng quát', '[]', '', '2026-08-10', 'Trạm Y tế Xã Tân An Hội', 'Huyết áp bình thường 120/80 mmHg, tim đều, không phát hiện bất thường', 'seed_key_1'),
(2, '079192087654', 'Khám sàng lọc bệnh', '["Ung thư cổ tử cung","Ung thư vú"]', '', '2026-08-12', 'Trạm Y tế Xã Tân An Hội', 'Chưa phát hiện khối u hoặc tổn thương bất thường', 'seed_key_2'),
(3, '079305099887', 'Khám sức khỏe tổng quát', '[]', '', '2026-08-14', 'Trạm Y tế Xã Tân An Hội', 'Thể lực tốt, mắt 10/10, chiều cao 1m52, cân nặng 42kg', 'seed_key_3');
