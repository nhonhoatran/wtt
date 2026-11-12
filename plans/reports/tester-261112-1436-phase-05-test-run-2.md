# Phase 05 test run 2 (sau review fixes) - 2026-11-12

Scope: full run, không diff-aware. Prod code không đổi. Chỉ thêm 1 test + 1 helper test.

## 1. Build dist
| Lệnh | Kết quả |
|---|---|
| `pnpm --filter @kamito/db build` | OK (prisma generate + tsc -p tsconfig.build.json, không lỗi) |
| `pnpm --filter @kamito/shared build` | OK (tsc, không lỗi) |

Lưu ý: exit code bị pipe `tail` che. Output sạch, không có lỗi.

## 2. Package tests / build
| Lệnh | Kết quả |
|---|---|
| `@kamito/shared test` | PASS: 14 files, 80 tests |
| `@kamito/worker test` | PASS: 6 files, 30 tests |
| `@kamito/admin test` | PASS: 4/4 (`node --test`) |
| `@kamito/admin build` | PASS: `tsc --noEmit` + `vite build`. Warning: chunk `index-*.js` 2.62 MB (>500 kB). Không chặn, không phải lỗi. |

## 3. API full suite (`pnpm exec vitest run`, pool=threads)
| Run | Kết quả | Thời gian | Ghi chú |
|---|---|---|---|
| 1 | PASS 37/37 files, 253/253 tests | 140 s | trước khi thêm test |
| 2 | PASS 37/37 files, 253/253 tests | 136 s | trước khi thêm test |
| 3 | **CRASH** exit `3221226505` (`0xC0000409`), không có summary | - | sau khi thêm test mới, chạy default reporter |
| 4 | PASS 37/37 files, 254/254 tests | 124 s | verbose reporter |
| 5 | PASS 37/37 files, 254/254 tests | - | verbose |
| 6 | PASS 37/37 files, 254/254 tests | - | verbose |

Output run 3 (nguyên văn, phần cuối):
```
[ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] @kamito/api@0.0.0 test: `vitest run`
Exit status 3221226505
```
Có 3 dòng DeprecationWarning `pg` (`client.query() when the client is already executing`), không liên quan crash.

**Crash 0xC0000409 (run 3):**
- Root cause: CHƯA XÁC ĐỊNH. Đây là fast-fail của Windows (STATUS_STACK_BUFFER_OVERRUN), không phải assertion fail. Không có stack trace, không có WER/Application Error event (đã query Event Log 8h, trống).
- Tái hiện: 1/6 full run với pool threads. Pool threads không loại bỏ hẳn crash như kỳ vọng. Lịch sử: fork pool crash ~14% (report 1436 cũ), phase-04 1/3.
- Giả thuyết chưa kiểm chứng: native addon chạy trong worker thread. Ứng viên: `sharp` (dùng trong `apps/api/test/support/media-test-kit.ts`), có thể cả Prisma/pg. Không có bằng chứng nào chỉ ra thủ phạm.
- Không sửa được mà không đổi prod hoặc che lỗi. Không retry mù.

Bằng chứng "đã chạy nhiều lần": 6 full run, 5 pass, 1 crash. Mẫu nhỏ, không đủ kết luận tỷ lệ.

## 4. Typecheck + lint (root)
`pnpm turbo run typecheck lint --force`: **14/14 successful**, exit 0.
Riêng api sau khi thêm test: `typecheck` (tsc --noEmit) OK, `lint` (eslint src test) OK.

## 5. Extra: xlsx theo layout Excel-save
Mục tiêu: kiểm `apps/worker/src/import/xlsx-row-reader.ts` với file zip có thứ tự như Excel (worksheet trước sharedStrings/styles).

**Đã làm:**
- Helper mới: `apps/api/test/support/excel-saved-xlsx.ts` (`buildExcelSavedXlsx`). XML viết tay, zip bằng fflate, thứ tự entry: `[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, `xl/worksheets/sheet1.xml`, `xl/sharedStrings.xml`, `xl/styles.xml`. Đã xác nhận thứ tự bằng cách liệt kê entry thực tế.
- Nội dung: header = shared string; tên VĐV = shared string; năm sinh = số (`1990`, `1991`) không phải text; mã nội dung ô A2 = formula `IF(1,"MS","")` với cached value `MS` (`t="str"`); dòng 3 rỗng (`<row r="3"/>`); seed = số.
- Test mới trong `apps/api/test/imports-worker.e2e-spec.ts`: `reads a workbook laid out like an Excel save: ...`. Chạy qua `worker.validateImport` đúng cách như các test có sẵn. Expect: job `VALIDATED`, totalRows 2, validRows 2, errorRows 0; rowNo [2, 4] đều VALID; data chứa tên và năm sinh.
- Chạy: `pnpm exec vitest run test/imports-worker.e2e-spec.ts` → 21/21 PASS (trước là 20). Chạy `-t "Excel save"` → PASS, 84 ms.

**Kết quả parse:** đúng. Shared string, số năm sinh, formula cached, dòng rỗng đều đọc đúng. Hàng 2 và 4 đều VALID.

**Test có phân biệt được không (đã probe, không sửa prod):**
Gọi trực tiếp `ExcelJS.stream.xlsx.WorkbookReader` lên đúng file này, KHÔNG qua `worksheetsLast`:
```
row 2 [null,{"formula":"IF(1,\"MS\",\"\")","result":"MS"},null,{"sharedString":15},null,1990]
row 4 [null,{"sharedString":16},null,{"sharedString":17},null,1991,...,5]
```
Tên VĐV ra `{"sharedString": n}` thay vì text. Nghĩa là nếu bỏ bước reorder, `cellText` trả '' và dòng sẽ lỗi. Test mới sẽ fail nếu hồi quy. Vậy `worksheetsLast` là bước cần thiết với file Excel thật và test bắt được lỗi này.

**Hạn chế:**
- Không có file do Excel thật tạo (máy không có Excel). File là XML viết tay, không phải Excel-saved bytes. `officecli` có cài (v1.0.160) nhưng chưa dùng: không biết layout nó ghi ra, và thời gian có hạn.
- Không thêm styles/theme/docProps đầy đủ như Excel. Chỉ có phần tối thiểu để exceljs đọc.

## Critical issues
1. Crash `0xC0000409` 1/6 full run API (threads). Root cause chưa rõ. Chặn độ tin cậy CI trên Windows. Không phải assertion fail, nhưng là lỗi chưa giải thích.

## Recommendations
1. Điều tra crash: chạy `pnpm exec vitest run` lặp 10 lần với `--reporter=verbose` ghi log từng file; xác định file cuối trước crash. Nếu tập trung ở file `media-*` hoặc có `sharp`, cô lập bằng `--exclude` và kiểm tra. Ghi lại file cuối cùng trước crash để có manh mối.
2. Nếu có Excel máy khác: lưu một file Excel thật vào `apps/api/test/fixtures/` (nhỏ, không có dữ liệu thật) và thêm test song song. Hiện tại chỉ có bản viết tay.
3. Admin build warning chunk 2.6 MB: dùng dynamic import cho các trang lớn. Không chặn release.
4. Hiện tại 254 test, đều có happy path + hostile files cho import. Thiếu: test chạy xlsx có nhiều sheet (chỉ kiểm sheet đầu, các sheet sau được drain nhưng không assert).

## Files changed (test only)
- NEW `apps/api/test/support/excel-saved-xlsx.ts`
- EDIT `apps/api/test/imports-worker.e2e-spec.ts` (+1 import, +1 test)
Không sửa prod code, schema, migration, `.env`. Không chạy `prisma db push`.

## Unresolved questions
- Root cause crash `0xC0000409` là gì? Cần log file-cuối-trước-crash. Có liên quan `sharp` hoặc pool threads không?
- Có cần file Excel thật (không phải viết tay) để chốt "matching a real Excel-saved workbook"?

## Status
**Status:** DONE_WITH_CONCERNS
- Build db/shared, shared/worker/admin test, admin build, turbo typecheck+lint: PASS.
- API full suite: 5/6 PASS (254 tests khi pass), 1 crash native 0xC0000409 chưa rõ nguyên nhân.
- Xlsx Excel-layout: PASS, test mới giữ lại, đã kiểm tra có phân biệt được.
