# Kiểm bản in nhánh đấu không cần API hoặc DB

Chạy từ `apps/client`:

```powershell
pnpm build
pnpm exec vitest run --config vitest.bracket-print.config.ts
```

Cần Chromium của Playwright đã cài. Bộ kiểm lấy font Archivo từ bản Next đã build, render `EventShell`/`EventHero` và `BracketBoard` thật bằng React server, đọc CSS module/global/design token thật. Hero có hạng giải, ngày, địa điểm, đơn vị đồng hành, tóm tắt và vé; nội dung có hai chooser và tiêu đề nhánh như trang giải. Không chạy Next/API, không gọi dịch vụ ngoài, không seed/query/migrate DB.

- Hàm chia trang: nhánh 2–256 suất, giữ nguyên từng trận và không đổi dữ liệu render màn hình.
- Browser: nhánh 64 suất, đơn/đôi, vi/en, viewport 1440/390, tên dài; toàn bộ 63 trận phải còn đủ và duy nhất.
- Bản in: A4/A3 ngang, không ellipsis/tràn ngang; mỗi khối nhánh vừa chiều cao giấy và PDF có đúng năm trang. Mỗi trang nhắc lại giải, nội dung, loại nhánh và phần nhánh.
- Nhánh nhiều tờ ẩn hero/tiêu đề dư khi in để không tạo trang đầu chỉ có tiêu đề; màn hình vẫn hiện đầy đủ. Nhánh nhỏ tám suất giữ hero/tiêu đề khi in.
- Artefact tại `apps/client/test-results/bracket-print/`: JSON số đo, PNG màn hình/in, tám PDF. Thư mục này được Git bỏ qua. Có thể đọc PDF bằng `pypdf` và mở ảnh trang để kiểm bổ sung.

Kiểm độc lập bằng trình đọc PDF, gồm đủ 64 tên đơn hoặc 128 tên đôi, 63 số trận duy nhất, ngữ cảnh từng trang và kích thước A4/A3; tùy chọn xuất ảnh trang PDF:

```powershell
uv run --with pypdf --with pymupdf python tests/offline/audit-bracket-pdf.py --render
```

Đây là kiểm component cùng bố cục in local. Không thay cho luồng vận hành giải đủ tám bước, kiểm toàn site hoặc các cổng M1/M2 trên staging.
