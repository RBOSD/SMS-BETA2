/**
 * 開立事項建檔
 * 選擇計畫後可連續輸入多筆事項
 */
import EmbedView from '../EmbedView';

export default function IssuesCreateTab() {
  return <EmbedView view="importView" tab="issues" sub="create" />;
}
