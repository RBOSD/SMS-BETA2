import { useParams, useNavigate } from 'react-router-dom';
import IssuesImportTab from './import/IssuesImportTab';
import IssuesCreateTab from './import/IssuesCreateTab';
import IssuesYearEditTab from './import/IssuesYearEditTab';
import PlansScheduleTab from './import/PlansScheduleTab';
import PlansManageTab from './import/PlansManageTab';

const ISSUES_SUB_TABS = [
  { id: 'batch', path: '/import/batch', label: '批次匯入' },
  { id: 'create', path: '/import/create', label: '開立事項建檔' },
  { id: 'year-edit', path: '/import/year-edit', label: '事項修正' },
];

const PLANS_SUB_TABS = [
  { id: 'schedule', path: '/import/schedule', label: '行程規劃' },
  { id: 'manage', path: '/import/manage', label: '計畫管理' },
];

export default function ImportView() {
  const { sub } = useParams();
  const activeSub = sub || 'batch';
  const navigate = useNavigate();

  const isIssues = ['batch', 'create', 'year-edit'].includes(activeSub);
  const isPlans = ['schedule', 'manage'].includes(activeSub);
  const renderContent = () => {
    switch (activeSub) {
      case 'batch':
        return <IssuesImportTab />;
      case 'create':
        return <IssuesCreateTab />;
      case 'year-edit':
        return <IssuesYearEditTab />;
      case 'schedule':
        return <PlansScheduleTab />;
      case 'manage':
        return <PlansManageTab />;
      default:
        return <IssuesImportTab />;
    }
  };

  const currentTabs = isPlans ? PLANS_SUB_TABS : ISSUES_SUB_TABS;

  return (
    <div className="import-view">
      <div className="admin-tabs">
        {currentTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`admin-tab-btn ${activeSub === t.id ? 'active' : ''}`}
            onClick={() => navigate(t.path)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="import-content">{renderContent()}</div>
    </div>
  );
}
