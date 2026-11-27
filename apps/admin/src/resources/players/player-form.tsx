import { stripDiacritics } from '@kamito/shared';
import { Card, DatePicker, Flex, Form, Input, InputNumber, Radio, Select, Switch, theme, type FormInstance } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { MediaUploadField } from '../../components/media-upload-field';
import { DATE_ONLY_FORMAT, DISPLAY_DATE_FORMAT } from '../events/event-labels';
import { GENDER_OPTIONS, HANDEDNESS_OPTIONS } from './player-labels';

const MIN_BIRTH_YEAR = 1900;

/** Empty optional text is dropped on create and sent as null on edit, so clearing a field really clears it. */
export function cleanPlayerValues(values: Record<string, unknown>, mode: 'create' | 'edit'): Record<string, unknown> {
  const entries = Object.entries(values).map(([key, value]): [string, unknown] => {
    const text = typeof value === 'string' ? value.trim() : value;
    return [key, text === '' || text === undefined ? null : text];
  });
  return Object.fromEntries(mode === 'create' ? entries.filter(([, value]) => value !== null) : entries);
}

/** Picking a birth date fills the birth year when it is still empty. */
export function fillBirthYear(form: FormInstance, changed: Record<string, unknown>) {
  const date = changed.birthDate;
  if (typeof date === 'string' && !form.getFieldValue('birthYear')) form.setFieldValue('birthYear', dayjs(date).year());
}

const dateProps = {
  getValueProps: (value?: string | null) => ({ value: value ? dayjs(value) : null }),
  normalize: (value: Dayjs | null) => (value ? value.format(DATE_ONLY_FORMAT) : null),
};

/** showPrivate: phone, email and exact birth date come only with players.update; other roles never receive them. */
export function PlayerFormFields({ form, autoFocus, showPrivate = true }: { form: FormInstance; autoFocus?: boolean; showPrivate?: boolean }) {
  const { token } = theme.useToken();
  const fullName = Form.useWatch('fullName', form) as string | undefined;
  const maxYear = new Date().getFullYear();

  return (
    <Flex vertical gap={token.margin}>
      <Card title="Thông tin chính">
        <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, whitespace: true, message: 'Nhập họ tên VĐV' }]}>
          <Input autoFocus={autoFocus} maxLength={200} />
        </Form.Item>
        <Form.Item name="gender" label="Giới tính" rules={[{ required: true, message: 'Chọn giới tính' }]}>
          <Radio.Group optionType="button" options={GENDER_OPTIONS} />
        </Form.Item>
        <Flex gap={token.margin} wrap>
          {showPrivate && (
            <Form.Item name="birthDate" label="Ngày sinh" {...dateProps}>
              <DatePicker format={DISPLAY_DATE_FORMAT} placeholder="Nếu biết" />
            </Form.Item>
          )}
          <Form.Item
            name="birthYear"
            label="Năm sinh"
            extra="Nhiều VĐV chỉ biết năm sinh; dùng để kiểm nhóm tuổi."
            rules={[{ type: 'number', min: MIN_BIRTH_YEAR, max: maxYear, message: `Năm sinh từ ${MIN_BIRTH_YEAR} đến ${maxYear}` }]}
          >
            <InputNumber precision={0} controls={false} />
          </Form.Item>
        </Flex>
        <Form.Item name="club" label="Câu lạc bộ">
          <Input maxLength={200} />
        </Form.Item>
        <Flex gap={token.margin} wrap>
          <Form.Item name="city" label="Tỉnh / thành phố">
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item
            name="countryCode"
            label="Mã quốc gia"
            extra="3 chữ in hoa, vd VIE. Để trống: dùng mã mặc định trong Cài đặt."
            normalize={(value: string) => value.toUpperCase()}
            rules={[{ pattern: /^[A-Z]{3}$/, message: 'Ba chữ in hoa, vd VIE' }]}
          >
            <Input maxLength={3} />
          </Form.Item>
        </Flex>
        <Form.Item name="fullNameEn" label="Tên tiếng Anh" extra="Để trống: tự bỏ dấu từ họ tên.">
          <Input maxLength={200} placeholder={fullName ? stripDiacritics(fullName) : undefined} />
        </Form.Item>
        <Flex gap={token.margin} wrap>
          <Form.Item name="handedness" label="Tay thuận">
            <Select allowClear options={HANDEDNESS_OPTIONS} style={{ minWidth: 140 }} />
          </Form.Item>
          <Form.Item name="gripStyle" label="Kiểu cầm vợt">
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="playStyle" label="Lối chơi">
            <Input maxLength={100} />
          </Form.Item>
        </Flex>
        <Form.Item name="isActive" label="Đang hoạt động" valuePropName="checked" extra="Tắt để không gợi ý VĐV này khi thêm đăng ký.">
          <Switch />
        </Form.Item>
      </Card>
      {showPrivate && (
        <Card title="Liên hệ (riêng tư)">
          <Form.Item name="phone" label="Số điện thoại" extra="Không bao giờ hiện trên site công khai.">
            <Input maxLength={30} />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Email không hợp lệ' }]}>
            <Input maxLength={200} />
          </Form.Item>
        </Card>
      )}
      <Card title="Hồ sơ công khai">
        <Form.Item name="photoMediaId" label="Ảnh đại diện">
          <MediaUploadField purpose="player-photo" />
        </Form.Item>
        <Form.Item name="isPublicProfile" label="Có trang hồ sơ công khai" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="noindex" label="Chặn Google lập chỉ mục" valuePropName="checked" extra="Yêu cầu công cụ tìm kiếm không lập chỉ mục, không ẩn trang. Tắt “Có trang hồ sơ công khai” để ẩn hồ sơ; tên trong kết quả và BXH vẫn hiển thị. Cần xác nhận đồng ý đúng phạm vi trước khi công khai.">
          <Switch />
        </Form.Item>
        <Form.Item name="publicDisplayName" label="Tên hiển thị công khai" extra="Để trống: dùng họ tên.">
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item name="bio" label="Tiểu sử (tiếng Việt)">
          <Input.TextArea rows={4} maxLength={5000} showCount />
        </Form.Item>
        <Form.Item name="bioEn" label="Tiểu sử (tiếng Anh)">
          <Input.TextArea rows={4} maxLength={5000} showCount />
        </Form.Item>
      </Card>
    </Flex>
  );
}
