import { Steps } from 'antd';

const STEP_ITEMS = [{ title: 'Tải file lên' }, { title: 'Kiểm tra dữ liệu' }, { title: 'Xác nhận nhập' }];

/** 0 = upload, 1 = worker checking, 2 = operator reviews, 3 = done. */
export function ImportStepsBar({ current }: { current: number }) {
  return <Steps size="small" current={current} items={STEP_ITEMS} />;
}
