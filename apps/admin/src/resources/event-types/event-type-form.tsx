import { Form, Input, InputNumber, Select } from 'antd';
import { MediaUploadField } from '../../components/media-upload-field';
import { CatalogCreatePage, CatalogEditPage, IsActiveField } from '../catalog-common/catalog-form-pages';
import { ColorHexField } from '../catalog-common/color-hex-field';
import { useCatalogSelect } from '../events/use-catalog-options';

export interface EventTypeRecord {
  id: string;
  tierId: string;
  tier: { id: string; code: string; name: string; colorHex: string };
  code: string;
  name: string;
  nameEn: string | null;
  colorHex: string | null;
  logoMediaId: string | null;
  backgroundMediaId: string | null;
  order: number;
  isActive: boolean;
}

function EventTypeFields({ currentTierId }: { currentTierId?: string }) {
  const { selectProps } = useCatalogSelect('tiers', { selected: currentTierId });
  return (
    <>
      <Form.Item name="tierId" label="Nhóm giải" rules={[{ required: true, message: 'Chọn nhóm giải' }]}>
        <Select {...selectProps} placeholder="Chọn nhóm giải" />
      </Form.Item>
      <Form.Item name="code" label="Mã" rules={[{ required: true, message: 'Nhập mã' }]} extra="Chữ in hoa, số, gạch ngang hoặc gạch dưới.">
        <Input />
      </Form.Item>
      <Form.Item name="name" label="Tên" rules={[{ required: true, message: 'Nhập tên' }]}>
        <Input />
      </Form.Item>
      <Form.Item name="nameEn" label="Tên tiếng Anh">
        <Input />
      </Form.Item>
      <Form.Item name="colorHex" label="Màu đại diện" extra="Bỏ trống để dùng màu của nhóm giải.">
        <ColorHexField allowClear />
      </Form.Item>
      <Form.Item name="logoMediaId" label="Logo">
        <MediaUploadField purpose="event-type-logo" />
      </Form.Item>
      <Form.Item name="backgroundMediaId" label="Ảnh nền">
        <MediaUploadField purpose="event-type-background" />
      </Form.Item>
      <Form.Item name="order" label="Thứ tự hiển thị" extra="Số nhỏ hiện trước. Bỏ trống để xếp cuối.">
        <InputNumber min={0} precision={0} />
      </Form.Item>
      <IsActiveField />
    </>
  );
}

export function EventTypeCreate() {
  return (
    <CatalogCreatePage resource="event-types" title="Thêm hạng giải" saveText="Tạo hạng giải">
      <EventTypeFields />
    </CatalogCreatePage>
  );
}

export function EventTypeEdit() {
  return (
    <CatalogEditPage<EventTypeRecord> resource="event-types" title={(record) => (record ? `Sửa: ${record.name}` : 'Sửa hạng giải')}>
      {(record) => <EventTypeFields currentTierId={record?.tierId} />}
    </CatalogEditPage>
  );
}
