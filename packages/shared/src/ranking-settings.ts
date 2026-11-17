import { z } from 'zod';
import { defineAppSetting, defineNumberSetting } from './app-setting-definition.js';

/** Defaults are examples; admins change them on /settings. */
export const rankingSettings = {
  overviewTopN: defineNumberSetting({
    key: 'ranking.overviewTopN',
    group: 'ranking',
    label: 'Số VĐV mỗi bảng ở trang tổng quan xếp hạng',
    description: 'Số dòng đầu của kỳ chốt đã công bố trên trang tổng quan xếp hạng công khai.',
    unit: 'VĐV',
    min: 1,
    max: 50,
    defaultValue: 10,
  }),
  defaultValidityDays: defineNumberSetting({
    key: 'ranking.defaultValidityDays',
    group: 'ranking',
    label: 'Thời hạn điểm xếp hạng mặc định',
    description: 'Điền sẵn khi tạo bảng xếp hạng mới. Điểm hết hạn sau số ngày này kể từ ngày kết thúc giải.',
    unit: 'ngày',
    min: 1,
    max: 3650,
    defaultValue: 365,
  }),
  awardPointsOnWalkoverLoss: defineAppSetting({
    key: 'ranking.awardPointsOnWalkoverLoss',
    group: 'ranking',
    label: 'Tính điểm khi thua walkover ở trận thật đầu tiên',
    description: 'Tắt thì VĐV bỏ cuộc (thua walkover) ngay trận thật đầu tiên không được điểm vòng đó.',
    schema: z.boolean(),
    defaultValue: false,
    editor: { kind: 'boolean' },
  }),
  dirtySweepAgeMinutes: defineNumberSetting({
    key: 'ranking.dirtySweepAgeMinutes',
    group: 'ranking',
    label: 'Tuổi dấu cần tính lại trước khi quét',
    description: 'Nội dung có dấu cần tính lại cũ hơn số phút này sẽ được xếp lại vào hàng đợi tính lại.',
    unit: 'phút',
    min: 1,
    max: 1440,
    defaultValue: 5,
  }),
} as const;
