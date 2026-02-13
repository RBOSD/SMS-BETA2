import { useParams, useNavigate } from 'react-router-dom';
import UsersTab from './users/UsersTab';
import LogsTab from './users/LogsTab';
import ActionsTab from './users/ActionsTab';
import SystemTab from './users/SystemTab';

const TABS = [
  { id: 'list', path: '/users/list', label: '帳號與群組管理' },
  { id: 'logs', path: '/users/logs', label: '登入紀錄' },
  { id: 'actions', path: '/users/actions', label: '操作歷程' },
  { id: 'system', path: '/users/system', label: '系統維護' },
];

export default function UsersView() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const activeTab = tab || 'list';

  const renderContent = () => {
    switch (activeTab) {
      case 'list':
        return <UsersTab />;
      case 'logs':
        return <LogsTab />;
      case 'actions':
        return <ActionsTab />;
      case 'system':
        return <SystemTab />;
      default:
        return <UsersTab />;
    }
  };

  return (
    <div className="users-view">
      <div className="admin-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`admin-tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => navigate(t.path)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="users-content">{renderContent()}</div>
    </div>
  );
}
