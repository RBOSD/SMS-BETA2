import { useParams } from 'react-router-dom';
import UsersTab from './users/UsersTab';
import LogsTab from './users/LogsTab';
import ActionsTab from './users/ActionsTab';
import SystemTab from './users/SystemTab';

export default function UsersView() {
  const { tab } = useParams();
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
      <div className="users-content">{renderContent()}</div>
    </div>
  );
}
