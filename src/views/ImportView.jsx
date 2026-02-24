import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import IssuesImportTab from './import/IssuesImportTab';
import IssuesCreateTab from './import/IssuesCreateTab';
import IssuesYearEditTab from './import/IssuesYearEditTab';
import PlansScheduleTab from './import/PlansScheduleTab';
import PlansManageTab from './import/PlansManageTab';
import PlanFormPage from './import/PlanFormPage';

const SUB_TITLES = {
  batch: '批次匯入',
  create: '開立事項建檔',
  'year-edit': '事項修正',
  schedule: '行程規劃',
  manage: '計畫管理',
};

export default function ImportView() {
  const { sub } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeSub = sub || 'batch';

  const formAction = searchParams.get('action');
  const formPlanId = searchParams.get('id');
  const showPlanForm = activeSub === 'manage' && (formAction === 'new' || (formAction === 'edit' && formPlanId));
  const pageTitle = showPlanForm ? (formAction === 'new' ? '新增檢查計畫' : '編輯檢查計畫') : (SUB_TITLES[activeSub] || '資料管理');

  const renderContent = () => {
    if (showPlanForm) return <PlanFormPage />;
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

  return (
    <div className="view-section active">
      <div className="content-header">
        <div className="content-title">{pageTitle}</div>
        {showPlanForm && (
          <button className="btn btn-outline" style={{ background: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.6)', color: '#fff' }} onClick={() => navigate('/import/manage')}>
            ← 返回列表
          </button>
        )}
      </div>
      <div className="import-content">{renderContent()}</div>
    </div>
  );
}
