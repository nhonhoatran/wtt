const HINTS: [RegExp, string][] = [
  [/Thiếu mã nội dung|Mã nội dung ".*" không có trong giải này/, 'Chọn mã nội dung từ danh sách thả xuống của file mẫu.'],
  [/Nội dung \S+ không có vòng loại|Vòng ".*" không hợp lệ/, 'Để trống ô Vòng hoặc chọn "Chính" / "Loại" cho đúng nội dung.'],
  [/Suất ".*" không hợp lệ/, 'Chọn một trong các suất của file mẫu hoặc để trống.'],
  [/Hạt giống ".*" phải là số/, 'Nhập hạt giống là số nguyên từ 1, hoặc để trống.'],
  [/Giới tính \d ".*" không hợp lệ/, 'Điền "Nam" hoặc "Nữ".'],
  [/Năm sinh \d ".*" không hợp lệ/, 'Điền năm sinh 4 chữ số, ví dụ 1998.'],
  [/dài quá \d+ ký tự/, 'Rút ngắn nội dung ô này.'],
  [/Thiếu VĐV 1|Nội dung đôi cần đủ|Nội dung đơn không có VĐV 2/, 'Đơn chỉ điền VĐV 1; đôi điền đủ VĐV 1 và VĐV 2.'],
  [/Không có VĐV mã/, 'Kiểm tra lại mã VĐV, hoặc để trống mã và điền họ tên + giới tính để tạo VĐV mới.'],
  [/đã được gộp vào mã/, 'Đổi sang mã VĐV mới nêu trong thông báo.'],
  [/Khác dữ liệu VĐV mã/, 'Sửa ô cho khớp hồ sơ VĐV trong hệ thống, hoặc để trống ô đó.'],
  [/Thiếu họ tên hoặc mã/, 'Điền mã VĐV hoặc họ tên.'],
  [/Thiếu giới tính/, 'Điền giới tính để tạo VĐV mới.'],
  [/Trùng với dòng|Trùng với một dòng khác|đã có ở dòng|Hạt giống \S+ trùng với dòng/, 'Xóa hoặc sửa một trong hai dòng trong file, rồi tải lại.'],
  [/đã đăng ký nội dung/, 'VĐV đã có trong nội dung này: bỏ dòng khỏi file, hoặc rút đăng ký cũ trước.'],
  [/Hạt giống \S+ đã có người/, 'Đổi sang hạt giống khác hoặc để trống.'],
];

/** One-line fix suggestion for a known validation message; undefined when the message already says enough. */
export function importFixHint(message: string): string | undefined {
  return HINTS.find(([pattern]) => pattern.test(message))?.[1];
}
