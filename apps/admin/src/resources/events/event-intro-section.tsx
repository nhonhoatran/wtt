import { Card, Form, Input, Switch } from 'antd';
import { RichTextField } from '../../components/rich-text-field';

const MAX_SUMMARY = 1000;

/** Public-facing text of an event; edit form only. Vietnamese is required content, English optional. */
export function EventIntroSection() {
  return (
    <Card title="Giới thiệu">
      <Form.Item name="shortName" label="Tên rút gọn" extra="Dùng ở nơi hẹp như lịch đấu, thẻ trên điện thoại.">
        <Input maxLength={60} />
      </Form.Item>
      <Form.Item name="nameEn" label="Tên tiếng Anh">
        <Input maxLength={200} />
      </Form.Item>
      <Form.Item name="presentedBy" label="Đơn vị tổ chức / trình bày">
        <Input maxLength={200} />
      </Form.Item>
      <Form.Item name="city" label="Tỉnh / thành phố">
        <Input maxLength={120} />
      </Form.Item>
      <Form.Item name="summary" label="Mô tả ngắn">
        <Input.TextArea rows={3} maxLength={MAX_SUMMARY} showCount />
      </Form.Item>
      <Form.Item name="summaryEn" label="Mô tả ngắn (tiếng Anh)">
        <Input.TextArea rows={3} maxLength={MAX_SUMMARY} showCount />
      </Form.Item>
      <Form.Item name="infoBody" label="Thông tin giải">
        <RichTextField />
      </Form.Item>
      <Form.Item name="infoBodyEn" label="Thông tin giải (tiếng Anh)">
        <RichTextField />
      </Form.Item>
      <Form.Item name="showInfoTab" label="Hiện tab Thông tin trên site" valuePropName="checked">
        <Switch />
      </Form.Item>
    </Card>
  );
}
