# PLAN.md — Hệ thống nhập liệu sức khỏe người dân

**Domain:** `https://nhaplieu.tak.id.vn`  
**Quy mô:** 20.000–30.000 hồ sơ, thiết kế sẵn để mở rộng 100.000+.

## 1. Mục tiêu

Xây dựng Web App thu thập và quản lý thông tin người dân đã khám sức khỏe hoặc khám sàng lọc, ưu tiên điện thoại và dễ dùng cho mọi lứa tuổi, kể cả người U60 ít sử dụng công nghệ.

Luồng chính:

**Mở link → Quét QR CCCD → tự điền thông tin hành chính → xác nhận → bổ sung thông tin còn thiếu → nhập thông tin khám → gửi.**

Luồng dự phòng:

**Nhập CCCD thủ công → tìm hồ sơ → nhập mới hoặc chỉnh sửa.**

QR CCCD phải là lựa chọn nổi bật nhằm chuẩn hóa dữ liệu, giảm sai họ tên, ngày sinh, giới tính, CCCD, địa chỉ và giảm thao tác nhập tay.

## 2. Quyền tự quyết của AI

AI/code agent được quyền chủ động chọn framework frontend, thư viện QR, cấu trúc module, schema chi tiết, session, cache, queue, pagination, retry, validation, logging và chiến lược triển khai.

Ưu tiên theo thứ tự:

1. Ổn định.
2. Tốc độ.
3. Bảo mật dữ liệu cá nhân.
4. Trải nghiệm người dân.
5. Dễ bảo trì.
6. Chi phí thấp.

Không over-engineer. Nếu benchmark chứng minh giải pháp khác tốt hơn, AI được phép thay đổi kiến trúc chi tiết nhưng phải ghi lý do trong `DECISIONS.md`.

## 3. Kiến trúc Cloudflare

Ưu tiên Cloudflare-native:

- Frontend nhẹ, mobile-first.
- Cloudflare Static Assets/CDN.
- Backend: Cloudflare Workers.
- Database: Cloudflare D1.
- Ảnh/file: Cloudflare R2 private.
- Turnstile + rate limiting.
- Queue/Durable Objects chỉ khi thật sự cần.

Không dùng VPS nếu Cloudflare serverless đáp ứng tốt. Static assets không chạy qua Worker nếu không cần. Không cache nhầm dữ liệu cá nhân.

## 4. QR CCCD và tài khoản người dân

Màn hình đầu:

**QUÉT QR CCCD**

Bên dưới:

**Không quét được? Nhập CCCD**

Camera sau phải tự nhận QR, không bắt bấm chụp. Nếu có thể, giải mã QR ngay trên thiết bị, không upload ảnh CCCD lên server.

Sau khi quét, tự điền các trường QR cung cấp như:

- CCCD/Mã định danh.
- Họ và tên.
- Ngày sinh.
- Giới tính.
- Địa chỉ/thông tin hành chính nếu có.

Không tự tạo dữ liệu mà QR không cung cấp.

CCCD là định danh duy nhất và phải có `UNIQUE INDEX`.

**Không dùng CCCD làm mật khẩu.**

Nếu hồ sơ cũ tồn tại, phải có bước xác minh bổ sung phù hợp trước khi cho xem hoặc sửa dữ liệu nhạy cảm.

## 5. Form người dân

Không hiển thị một form dài. Chia khoảng 4 bước:

1. Thông tin hành chính.
2. Nơi ở và liên hệ.
3. Thông tin khám.
4. Kiểm tra và gửi.

Thông tin phải bám mẫu nghiệp vụ:

### Hành chính
- Họ tên.
- Giới tính.
- Ngày sinh.
- Dân tộc.
- Nhóm máu nếu có.
- CCCD/Mã định danh.
- BHYT.
- Nơi ở hiện tại.
- Xã/phường.
- Nghề nghiệp.
- Nơi làm việc/học tập.
- Họ tên mẹ/người giám hộ với người từ 16 tuổi trở xuống.
- Điện thoại.
- Đối tượng.

### Đối tượng
- Trẻ đi học.
- Trẻ không đi học.
- Sinh viên/học viên.
- Lao động chính thức.
- Lao động phi chính thức.
- Người cao tuổi.

### Thông tin khám
- Khám sức khỏe tổng quát.
- Khám sàng lọc.
- Loại sàng lọc.
- Ngày khám.
- Nơi khám.
- Kết quả khám.
- Ảnh/file kết quả nếu có.

Conditional logic phải tự ẩn/hiện trường phù hợp.

## 6. UX cho người U60

Mobile-first, chữ rõ, nút lớn, ít thao tác.

Yêu cầu:
- Font khoảng 17–18px.
- Nút chính cao 52–56px.
- Khoảng cách trường rộng.
- Không dùng thuật ngữ kỹ thuật.
- Không yêu cầu email.
- Không bắt nhập lại dữ liệu QR đã đọc.
- Nút Back không làm mất dữ liệu.
- Tự giữ draft khi mạng yếu.
- Validation phải nói rõ lỗi.
- Chống double-click/double-submit.
- Loading phải có trạng thái cụ thể.

Ví dụ:

**“Số CCCD cần đủ 12 chữ số.”**

Không dùng thông báo kiểu **“Invalid input.”**

## 7. Upload ảnh/file

Ảnh được resize/compress trên trình duyệt trước khi upload, ưu tiên WebP/JPEG, mục tiêu khoảng 500 KB–1 MB nếu vẫn đọc rõ.

Luồng:

1. Browser xin presigned URL.
2. Upload trực tiếp R2.
3. Backend chỉ nhận `object_key` và metadata.
4. D1 không lưu Base64/blob.

R2 phải private. Không dùng CCCD làm tên file; dùng UUID/random key. Khi admin xem ảnh, backend cấp signed URL có thời hạn. Có cơ chế dọn file rác nếu upload thành công nhưng form chưa submit.

## 8. Database và API

Có thể tách thành:

- `citizens`
- `addresses`
- `health_examinations`
- `attachments`
- `admins`
- `audit_logs`

AI được quyền thiết kế schema khác nếu tốt hơn.

Index các trường thường tra cứu: CCCD, số điện thoại, ngày khám, trạng thái, ngày tạo/cập nhật, địa bàn.

Submit phải dùng transaction/upsert hợp lý và idempotency key để chống ghi trùng. Backend phải validate lại toàn bộ dữ liệu frontend.

## 9. Trang quản trị `/manage`

Trang quản trị tách biệt với giao diện người dân.

Chức năng:

- Dashboard tổng hồ sơ.
- Hồ sơ mới/cập nhật.
- Thống kê theo đối tượng, ngày khám, địa bàn, trạng thái.
- Search CCCD, họ tên, SĐT.
- Filter nhiều điều kiện.
- Sort phía server.
- Pagination 50–100 dòng/trang.
- Xem chi tiết hồ sơ.
- Xem lịch sử khám.
- Xem ảnh/file.
- Sửa hồ sơ theo quyền.
- Audit log.
- Export Excel/CSV.

**Không bao giờ load toàn bộ 30.000 hồ sơ vào browser.**

Bulk action và export lớn phải chia batch/job, không khóa giao diện.

## 10. Phân quyền và bảo mật

Tối thiểu hỗ trợ:

- Super Admin.

Mọi thao tác nhạy cảm như xem, sửa, xóa, export phải ghi audit log.

Không expose secret/API key trong frontend. Session/cookie phải an toàn.

Chống:
- dò CCCD hàng loạt;
- brute force;
- spam submit;
- sửa request qua DevTools;
- upload file giả;
- XSS;
- injection;
- CSRF khi phù hợp.

## 11. Hiệu năng và nghiệm thu

Mục tiêu:

- 20.000–30.000 hồ sơ hoạt động ổn định.
- Mở rộng 100.000+ không viết lại hệ thống.
- Burst khoảng 100–300 submit đồng thời không mất dữ liệu.
- Tra CCCD nhanh.
- Admin tìm/lọc nhanh.
- Upload ảnh không làm nghẽn Worker.
- Mạng yếu có retry an toàn.
- Không tạo hồ sơ trùng.

Phải test mạng 4G yếu, mất mạng giữa lúc nhập, upload lỗi, double-submit, nhiều người submit cùng lúc và export lớn.

Hệ thống chỉ được coi là hoàn thành khi:

1. Người U60 có thể tự quét CCCD và gửi form.
2. QR tự điền phần lớn thông tin hành chính.
3. Hồ sơ cũ được tìm và cập nhật an toàn.
4. Admin tìm kiếm/lọc nhanh ở 30.000+ hồ sơ.
5. Không có thao tác nào load toàn bộ database vào browser.
6. Có migration, backup/restore, logging và monitoring.
7. Dữ liệu không trùng khi người dùng gửi nhiều lần.
8. Hoạt động tốt trên điện thoại phổ thông và mạng yếu.
