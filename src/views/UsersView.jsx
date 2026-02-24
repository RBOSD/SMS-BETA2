import { useParams } from 'react-router-dom';
import UsersTab from './users/UsersTab';
import LogsTab from './users/LogsTab';
import ActionsTab from './users/ActionsTab';
import SystemTab from './users/SystemTab';

const TAB_TITLES = {
  list: '帳號與群組管理',
  logs: '登入紀錄',
  actions: '操作歷程',
  system: '系統維護',
};

export default function UsersView() {
  const { tab } = useParams();
  const activeTab = tab || 'list';
  const pageTitle = TAB_TITLES[activeTab] || '後台管理';

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
    <div className="view-section active">
      <div className="content-header">
        <div className="content-title">{pageTitle}</div>
      </div>
      <div className="users-content">{renderContent()}</div>
    </div>
  );
}
