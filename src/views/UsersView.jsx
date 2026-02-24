import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import UsersTab from './users/UsersTab';
import UserFormPage from './users/UserFormPage';
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = tab || 'list';

  const formAction = searchParams.get('action');
  const formUserId = searchParams.get('id');
  const showUserForm = activeTab === 'list' && (formAction === 'new' || (formAction === 'edit' && formUserId));
  const pageTitle = showUserForm ? (formAction === 'new' ? '新增使用者' : '編輯使用者') : (TAB_TITLES[activeTab] || '後台管理');

  const renderContent = () => {
    if (showUserForm) return <UserFormPage />;
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
        {showUserForm && (
          <button className="btn btn-outline" style={{ background: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.6)', color: '#fff' }} onClick={() => navigate('/users/list')}>
            ← 返回列表
          </button>
        )}
      </div>
      <div className="users-content">{renderContent()}</div>
    </div>
  );
}
