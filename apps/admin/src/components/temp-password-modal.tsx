import { Alert, Descriptions, Modal, theme, Typography } from 'antd';
import dayjs from 'dayjs';

export interface TempPasswordInfo {
  email: string;
  tempPassword: string;
  tempPasswordExpiresAt: string;
}

/** Shown once after creating a user or issuing a new temporary password; it cannot be shown again. */
export function TempPasswordModal({ info, onClose }: { info: TempPasswordInfo | null; onClose: () => void }) {
  const { token } = theme.useToken();
  return (
    <Modal
      open={Boolean(info)}
      title="Mật khẩu tạm"
      onOk={onClose}
      onCancel={onClose}
      okText="Đã lưu lại, đóng"
      cancelButtonProps={{ style: { display: 'none' } }}
      maskClosable={false}
      destroyOnHidden
    >
      {info && (
        <>
          <Alert
            type="warning"
            showIcon
            message="Mật khẩu này chỉ hiện một lần. Gửi cho người dùng ngay; họ phải đổi mật khẩu ở lần đăng nhập đầu."
            style={{ marginBottom: token.margin }}
          />
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Email">{info.email}</Descriptions.Item>
            <Descriptions.Item label="Mật khẩu tạm">
              <Typography.Text code copyable={{ tooltips: ['Sao chép', 'Đã sao chép'] }}>
                {info.tempPassword}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Hết hạn lúc">
              {dayjs(info.tempPasswordExpiresAt).format('HH:mm DD/MM/YYYY')}
            </Descriptions.Item>
          </Descriptions>
        </>
      )}
    </Modal>
  );
}
