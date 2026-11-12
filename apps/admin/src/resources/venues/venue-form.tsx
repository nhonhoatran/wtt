import { Form, Input } from 'antd';
import { CatalogCreatePage, CatalogEditPage, IsActiveField } from '../catalog-common/catalog-form-pages';
import { VenueTablesSection } from './venue-tables-section';

export interface VenueRecord {
  id: string;
  name: string;
  nameEn: string | null;
  address: string | null;
  city: string | null;
  mapUrl: string | null;
  isActive: boolean;
  tableCount: number;
}

function VenueFields() {
  return (
    <>
      <Form.Item name="name" label="Tên địa điểm" rules={[{ required: true, message: 'Nhập tên' }]}>
        <Input autoFocus />
      </Form.Item>
      <Form.Item name="nameEn" label="Tên tiếng Anh">
        <Input />
      </Form.Item>
      <Form.Item name="address" label="Địa chỉ">
        <Input />
      </Form.Item>
      <Form.Item name="city" label="Tỉnh / thành phố">
        <Input />
      </Form.Item>
      <Form.Item name="mapUrl" label="Liên kết bản đồ" extra="Chỉ nhận liên kết bắt đầu bằng https://">
        <Input placeholder="https://" />
      </Form.Item>
      <IsActiveField />
    </>
  );
}

export function VenueCreate() {
  return (
    <CatalogCreatePage resource="venues" title="Thêm địa điểm" saveText="Tạo địa điểm" redirect="edit">
      <VenueFields />
    </CatalogCreatePage>
  );
}

export function VenueEdit() {
  return (
    <CatalogEditPage<VenueRecord> resource="venues" title={(record) => (record ? `Sửa: ${record.name}` : 'Sửa địa điểm')} footer={(record) => record && <VenueTablesSection venueId={record.id} />}>
      {() => <VenueFields />}
    </CatalogEditPage>
  );
}
