# Kiểm tra tương thích hai phiên bản API — 2026-11-21

## Kết quả

Hai image API từ commit đã chốt đều vượt qua lượt kiểm tra tương thích cục bộ có giới hạn, dùng chung fixture mới với schema 18 migration hiện tại. Kết quả này chỉ xác nhận cặp API component; chưa chứng minh rollback toàn bộ release hay phục hồi production.

- Phiên bản hiện tại: `9648eb49713bedd34c3422833e0015e7452d58cd`, image `sha256:9589465ac5efeef6c1157e09e7a00ae9ab47269ace96740cc2d48e9c898c779f`.
- Phiên bản trước: `59279ac3684f9e97bcede76e8288244a662eb90c`, image `sha256:3aceba4acaccc31d7292c2be699d5e89b3a6a80f08e505bbec418c9bdaefaa2d`.
- Cả hai phiên bản trả HTTP 200; trạng thái sẵn sàng báo database, migrations, Redis và storage đều hoạt động.
- GET bài viết chỉ đọc trả 200; request thiếu SSR secret trả 403.
- Schema 18 migration, toàn bộ dữ liệu bảng và trạng thái sequence, cùng manifest object S3 mẫu không đổi sau từng lượt kiểm tra API.
- Dọn fixture đạt: không còn container, volume hay network thuộc lượt test; các cổng test trống và hash file `.env` gốc không đổi.

## Bằng chứng

- Kết quả runtime: `test-results/261120-api-rollback-runtime-fa355f69-c559-4fc4-b2f2-2f7c9588f09a/1795270106745/result.json`
- Biên nhận dọn fixture: `test-results/261120-api-rollback-runtime-fa355f69-c559-4fc4-b2f2-2f7c9588f09a/1795270106745/cleanup.json`
- Log build image phiên bản trước: `test-results/261120-api-rollback/67e49e56-f2bf-4817-98ec-d3443c968bd7/build-previous-resume-821099ef-7403-4cfd-bb33-fa053d9518b3.log`
- Biên nhận build: `test-results/261120-api-rollback/67e49e56-f2bf-4817-98ec-d3443c968bd7/build-manifest-resumed.json`
- Biên nhận dọn image cuối: `test-results/261120-api-rollback/67e49e56-f2bf-4817-98ec-d3443c968bd7/image-cleanup-final-1795270705851.json`
- Hash môi trường build không đổi; source archive và bằng chứng build ban đầu được giữ nguyên.

Hai ID và tag image thuộc lượt test hiện đã được gỡ. Image hiện tại bị gỡ bởi lệnh dọn trước đó: lệnh báo lỗi ở đối số thứ hai sau khi đối số thứ nhất đã chạy thành công. Biên nhận cuối ghi image này là đã vắng mặt. Image phiên bản trước được gỡ theo đúng tag sau khi xác minh lại label, digest tham chiếu và không có container nào tham chiếu.