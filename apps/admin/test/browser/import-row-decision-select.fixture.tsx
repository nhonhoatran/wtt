import '@ant-design/v5-patch-for-react-19';
import { App } from 'antd';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ImportRowDecisionSelect } from '../../src/components/import-row-decision-select';

const candidates = [
  { id: 'player-a', code: 'KMT001', fullName: 'Nguyễn Trần Hoàng Minh Anh', gender: 'MALE', birthYear: 1991, club: 'Câu lạc bộ bóng bàn Phường Nguyễn Thái Bình Thành phố Hồ Chí Minh' },
  { id: 'player-b', code: 'KMT002', fullName: 'Nguyễn Trần Hoàng Minh Anh', gender: 'MALE', birthYear: 1988, club: 'Câu lạc bộ bóng bàn Thanh Thiếu Niên Quận Hai Bà Trưng Hà Nội' },
];

function Fixture() {
  const [saved, setSaved] = useState(0);
  return (
    <App>
      <div className="table-scroll">
        <table><tbody><tr><td>
          <div className="player-cell">
            <ImportRowDecisionSelect
              importId="fixture-import"
              rowNo={7}
              slot={1}
              candidates={candidates}
              onDecided={() => setSaved((value) => value + 1)}
            />
          </div>
        </td></tr></tbody></table>
      </div>
      <output aria-label="Số lựa chọn đã lưu">{saved}</output>
    </App>
  );
}

createRoot(document.getElementById('root')!).render(<Fixture />);
