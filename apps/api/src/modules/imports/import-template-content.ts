/** Text and layout of the template's static sheets. */
export const INSTRUCTIONS = [
  'HƯỚNG DẪN NHẬP ĐĂNG KÝ',
  '1. Mỗi dòng ở sheet "Đăng ký" là một lượt đăng ký (một VĐV đơn hoặc một cặp đôi).',
  '2. Nội dung đơn: để trống các cột VĐV 2. Nội dung đôi: nhập đủ VĐV 1 và VĐV 2.',
  '3. VĐV đã có trong hệ thống: chỉ cần nhập "Mã VĐV" (xem sheet "VĐV đã có"). Họ tên, giới tính, năm sinh nếu nhập phải khớp với hệ thống.',
  '4. VĐV mới: để trống mã, nhập họ tên và giới tính (năm sinh và CLB nên có). Hệ thống tự cấp mã.',
  '5. Chỉ trùng tên với VĐV đã có: hệ thống sẽ hỏi bạn chọn "Liên kết" hay "Tạo VĐV mới" ở bước xem trước.',
  '6. Mã nội dung chọn từ danh sách thả xuống (danh sách bên dưới). Giới tính: Nam / Nữ.',
  '7. Vòng: Chính hoặc Loại (để trống = Chính). Suất: Thường, Đặc cách hoặc Từ vòng loại (để trống = Thường).',
  '8. Hạt giống: số nguyên từ 1, để trống nếu không là hạt giống. Mỗi hạt giống chỉ dùng một lần trong cùng nội dung và vòng.',
  '9. Không đổi tên, thứ tự cột ở dòng đầu. Dòng trống được bỏ qua.',
];

export const PLAYER_SHEET_COLUMNS = [
  { header: 'Mã VĐV', width: 14 },
  { header: 'Họ tên', width: 28 },
  { header: 'Giới tính', width: 10 },
  { header: 'Năm sinh', width: 10 },
  { header: 'CLB', width: 24 },
];
