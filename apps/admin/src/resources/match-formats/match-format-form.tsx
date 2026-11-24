import { Form, Input, InputNumber, Switch } from 'antd';
import { CatalogCreatePage, CatalogEditPage, IsActiveField } from '../catalog-common/catalog-form-pages';

export interface MatchFormatRecord {
  id: string;
  name: string;
  nameEn: string | null;
  bestOf: number;
  pointsPerGame: number;
  winBy: number;
  estimatedMinutes: number;
  isDefault: boolean;
  isActive: boolean;
}

const oddNumber = {
  validator: (_: unknown, value: number | null) =>
    value === null || value === undefined || value % 2 === 1 ? Promise.resolve() : Promise.reject(new Error('Số ván tối đa phải là số lẻ')),
};

function MatchFormatFields({ isDefault }: { isDefault?: boolean }) {
  return (
    <>
      <Form.Item name="name" label="Tên thể thức" rules={[{ required: true, message: 'Nhập tên' }]}>
        <Input autoFocus />
      </Form.Item>
      <Form.Item name="nameEn" label="Tên tiếng Anh">
        <Input />
      </Form.Item>
      <Form.Item name="bestOf" label="Số ván tối đa" rules={[{ required: true, message: 'Nhập số ván' }, oddNumber]} extra="Số lẻ, ví dụ 3 hoặc 5.">
        <InputNumber min={1} max={9} step={2} precision={0} suffix="ván" />
      </Form.Item>
      <Form.Item name="pointsPerGame" label="Số điểm mỗi ván" rules={[{ required: true, message: 'Nhập số điểm' }]}>
        <InputNumber min={5} max={50} precision={0} suffix="điểm" />
      </Form.Item>
      <Form.Item name="winBy" label="Cách biệt tối thiểu" rules={[{ required: true, message: 'Nhập số điểm cách biệt' }]} extra="Số điểm hơn đối thủ để thắng ván.">
        <InputNumber min={1} max={5} precision={0} suffix="điểm" />
      </Form.Item>
      <Form.Item name="estimatedMinutes" label="Thời gian ước tính mỗi trận" rules={[{ required: true, message: 'Nhập số phút' }]}>
        <InputNumber min={5} max={240} precision={0} suffix="phút" />
      </Form.Item>
      <Form.Item
        name="isDefault"
        label="Mặc định"
        valuePropName="checked"
        extra={isDefault ? 'Đây là thể thức mặc định. Muốn đổi, hãy đặt thể thức khác làm mặc định.' : 'Được chọn sẵn khi tạo nội dung thi đấu mới.'}
      >
        <Switch disabled={isDefault} />
      </Form.Item>
      <IsActiveField />
    </>
  );
}

export function MatchFormatCreate() {
  return (
    <CatalogCreatePage resource="match-formats" title="Thêm thể thức trận" saveText="Tạo thể thức" initialValues={{ isDefault: false }}>
      <MatchFormatFields />
    </CatalogCreatePage>
  );
}

export function MatchFormatEdit() {
  return (
    <CatalogEditPage<MatchFormatRecord> resource="match-formats" title={(record) => (record ? `Sửa: ${record.name}` : 'Sửa thể thức trận')}>
      {(record) => <MatchFormatFields isDefault={record?.isDefault} />}
    </CatalogEditPage>
  );
}
