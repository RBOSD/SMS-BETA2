import { useParams, useSearchParams } from 'react-router-dom';
import IssuesImportTab from './import/IssuesImportTab';
import IssuesCreateTab from './import/IssuesCreateTab';
import IssuesYearEditTab from './import/IssuesYearEditTab';
import PlansScheduleTab from './import/PlansScheduleTab';
import PlansManageTab from './import/PlansManageTab';
import PlanFormPage from './import/PlanFormPage';

export default function ImportView() {
  const { sub } = useParams();
  const [searchParams] = useSearchParams();
  const activeSub = sub || 'batch';

  const formAction = searchParams.get('action');
  const formPlanId = searchParams.get('id');
  const showPlanForm = activeSub === 'manage' && (formAction === 'new' || (formAction === 'edit' && formPlanId));

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
    <div className="import-view">
      <div className="import-content">{renderContent()}</div>
    </div>
  );
}
