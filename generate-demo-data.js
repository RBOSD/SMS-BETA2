/**
 * 開立事項與檢查計畫假資料生成器（獨立腳本，與網站無掛勾）
 * 使用方式：node generate-demo-data.js
 * 輸出：demo-issues.json、demo-plans.json（專案根目錄）
 * 年度配合開立事項隨機產生的 112、113、114
 * 展示完畢後可刪除此檔及 load-demo-data.js
 */
const fs = require('fs');
const path = require('path');

const UNITS = ['臺鐵', '高鐵', '林鐵', '糖鐵'];
const UNIT_CODES = { '臺鐵': 'T', '高鐵': 'H', '林鐵': 'A', '糖鐵': 'S' };
const STATUSES = ['持續列管', '解除列管', '自行列管'];
const DIVISIONS = ['運務', '工務', '機務', '電務', '安全', '審核', '災防', '運轉', '土木', '機電', '土建', '安全管理', '營運', '其他'];
const INSPECTIONS = ['定期檢查', '例行性檢查', '特別檢查', '臨時檢查', '調查'];
const KINDS = ['N', 'O', 'R', ''];
const KIND_LABELS = { N: '缺失', O: '觀察', R: '建議', '': '-' };

const CONTENT_TEMPLATES = [
  '車站月台安全設施檢查缺失事項',
  '軌道養護作業未依規定辦理',
  '號誌設備維護紀錄未完整填寫',
  '電車線設備絕緣檢測未通過',
  '列車行車紀錄器資料保存期限不足',
  '站務人員教育訓練時數未達標準',
  '隧道內照明設備照度不足',
  '平交道防護設施故障未即時通報',
  '軌道幾何量測超限未改善',
  '車輛轉向架檢修紀錄缺漏',
  '車站無障礙設施標示不清',
  '行車控制室人員配置不足',
  '鐵路沿線雜草未定期清除',
  '橋梁結構安全檢測未依期辦理',
  '地下化區段排水系統淤積',
  '列車空調系統效能不足',
  '車站消防設備檢修逾期',
  '軌道電路絕緣不良',
  '道岔轉轍器動作異常',
  '旅客資訊顯示系統故障頻繁',
  '月台門與列車對位誤差過大',
  '行車人員疲勞駕駛風險管理不足',
  '危險品運送申報程序未落實',
  '鐵路用地遭占用未排除',
  '邊坡監測系統資料未即時上傳',
  '列車煞車系統檢測未完成',
  '車站電梯保養合約逾期',
  '軌道扣件鬆動未即時更換',
  '號誌連鎖邏輯測試未通過',
  '電力系統諧波污染超標',
];

const HANDLING_TEMPLATES = [
  '已完成相關設施改善，並加強巡檢頻率。',
  '已依規定辦理改善作業，並建立標準作業程序。',
  '已補正缺失紀錄，並加強人員教育訓練。',
  '已更換故障設備，並納入預防性保養計畫。',
  '已延長資料保存期限，並建立備援機制。',
  '已安排補訓課程，預計下月完成。',
  '已更換照明設備，照度已符合標準。',
  '已建立即時通報機制，並完成演練。',
  '已辦理軌道整正作業，複測合格。',
  '已補齊檢修紀錄，並加強督導。',
  '已更新標示，並加設語音導引。',
  '已調整班表，確保人力充足。',
  '已排定除草計畫，定期執行。',
  '已委託專業機構辦理檢測。',
  '已辦理清淤作業，並加強巡查。',
  '已更換空調主機，效能已改善。',
  '已完成消防設備檢修。',
  '已更換絕緣材料，測試合格。',
  '已調整道岔，運轉正常。',
  '已更新顯示系統軟體，故障率已降低。',
  '已校正對位系統，誤差在容許範圍內。',
  '已實施輪班調整及休息管理。',
  '已建立申報查核機制。',
  '已協調相關單位辦理排除。',
  '已修復上傳系統，資料即時更新。',
  '已完成煞車系統檢測。',
  '已簽訂新保養合約。',
  '已辦理扣件更換作業。',
  '已重新測試並修正邏輯。',
  '已加裝濾波設備，諧波已改善。',
];

const REVIEW_TEMPLATES = [
  '改善情形符合要求，建議持續追蹤。',
  '請於下次檢查前完成複查。',
  '改善完成，同意解除列管。',
  '請補充改善前後照片佐證。',
  '改善方向正確，請持續落實。',
  '尚有部分項目待改善，請於期限內完成。',
  '改善情形良好，建議納入標準作業。',
  '請加強相關人員訓練。',
  '改善已完成，本案解除列管。',
  '請建立預防機制，避免再犯。',
  '改善情形可接受，持續列管觀察。',
  '請於一個月內提送改善報告。',
  '改善進度符合預期，同意結案。',
  '請檢附第三方檢測報告。',
  '改善措施妥適，建議定期檢視。',
  '尚有改善空間，請再強化。',
  '改善完成，本案解除列管。',
  '請建立長效管理機制。',
  '改善情形符合要求。',
  '請持續監控改善成效。',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rocDate(year, month, day) {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}${m}${d}`;
}

function addDays(baseY, baseM, baseD, days) {
  const d = new Date(1911 + baseY, baseM - 1, baseD);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear() - 1911;
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return { y, m, day };
}

function generateNumber(year, unitCode, seq) {
  const divCodes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'OP', 'CV', 'ME', 'EL', 'SM', 'AD', 'OT', 'CP', 'EM'];
  const div = pick(divCodes);
  const kind = pick(['N', 'O', 'R']);
  const divNum = String(randomInt(1, 99)).padStart(2, '0');
  const kindNum = String(randomInt(1, 99)).padStart(2, '0');
  const inspect = randomInt(1, 5);
  return `${year}${unitCode}${inspect}-${div}${divNum}-${kind}${kindNum}`;
}

function generateItem(index, year, usedNumbers) {
  const unit = pick(UNITS);
  const unitCode = UNIT_CODES[unit];
  let number;
  let attempts = 0;
  do {
    number = generateNumber(year, unitCode, index);
    attempts++;
    if (attempts > 100) number = `${year}${unitCode}${randomInt(1,5)}-${String(index).padStart(4, '0')}-N01`;
  } while (usedNumbers.has(number));
  usedNumbers.add(number);

  const status = pick(STATUSES);
  const division = pick(DIVISIONS);
  const inspection = pick(INSPECTIONS);
  const kind = pick(KINDS);
  const content = pick(CONTENT_TEMPLATES) + (randomInt(0, 1) ? ' 另經查尚有相關改善項目待辦理。' : '');
  const planName = `${year}年度${unit}${inspection}計畫`;

  const issueMonth = randomInt(1, 12);
  const issueDay = randomInt(1, 28);
  const issueDate = rocDate(year, issueMonth, issueDay);

  const numRounds = randomInt(1, 6);
  const rounds = [];

  for (let r = 0; r < numRounds; r++) {
    const baseDays = r * 45 + randomInt(10, 30);
    const { y, m, day } = addDays(year, issueMonth, issueDay, baseDays);
    const replyDate = rocDate(y, m, day);
    const { y: y2, m: m2, day: d2 } = addDays(y, m, day, randomInt(7, 21));
    const responseDate = rocDate(y2, m2, d2);

    const handling = pick(HANDLING_TEMPLATES) + (r > 0 ? ` 第${r + 1}次辦理情形已依審查意見修正。` : '');
    const review = r < numRounds - 1 ? pick(REVIEW_TEMPLATES) : (status === '解除列管' ? '改善完成，本案解除列管。' : pick(REVIEW_TEMPLATES));

    rounds.push({
      handling,
      review,
      replyDate,
      responseDate,
    });
  }

  const first = rounds[0];
  const item = {
    number,
    year: String(year),
    unit,
    content,
    status,
    item_kind_code: kind || undefined,
    division_name: division,
    inspection_category_name: inspection,
    plan_name: planName,
    issue_date: issueDate,
    handling: first.handling,
    review: first.review,
    reply_date_r1: first.replyDate,
    response_date_r1: first.responseDate,
  };
  if (!item.item_kind_code) delete item.item_kind_code;

  if (rounds.length > 1) {
    item.rounds = rounds;
    for (let i = 1; i < rounds.length; i++) {
      const n = i + 1;
      item[`handling${n}`] = rounds[i].handling;
      item[`review${n}`] = rounds[i].review;
      item[`reply_date_r${n}`] = rounds[i].replyDate;
      item[`response_date_r${n}`] = rounds[i].responseDate;
    }
  }

  return item;
}

// 檢查計畫：railway 代碼、inspection_type 代碼對照
const RAILWAY_CODES = { '臺鐵': 'T', '高鐵': 'H', '林鐵': 'A', '糖鐵': 'S' };
const INSPECTION_TYPE_MAP = {
  '定期檢查': '1',
  '年度定期檢查': '1',
  '例行性檢查': '3',
  '特別檢查': '2',
  '臨時檢查': '4',
  '調查': '5',
};
const BUSINESS_CODES = ['OP', 'CV', 'ME', 'EL', 'SM', 'AD', 'OT', null];

function generatePlans(years, totalPlans = 100) {
  const planKeys = new Set();
  const plans = [];

  // 1. 先產生與開立事項格式一致的 60 筆（3年×4機構×5檢查類別）
  for (const year of years) {
    for (const unit of UNITS) {
      for (const inspection of INSPECTIONS) {
        const planName = `${year}年度${unit}${inspection}計畫`;
        const key = `${planName}|||${year}`;
        if (planKeys.has(key)) continue;
        planKeys.add(key);
        plans.push({
          plan_name: planName,
          year: String(year),
          railway: RAILWAY_CODES[unit],
          inspection_type: INSPECTION_TYPE_MAP[inspection] || '1',
          business: pick(BUSINESS_CODES),
          planned_count: randomInt(2, 12),
        });
      }
    }
  }

  // 2. 補足至約 100 筆，使用不同後綴
  const SUFFIXES = ['補充查核計畫', '複查計畫', '專案檢查計畫', '追蹤查核計畫', '重點檢查計畫'];
  let added = 0;
  while (plans.length < totalPlans && added < 50) {
    const year = pick(years);
    const unit = pick(UNITS);
    const inspection = pick(INSPECTIONS);
    const suffix = pick(SUFFIXES);
    const planName = `${year}年度${unit}${inspection}${suffix}`;
    const key = `${planName}|||${year}`;
    if (planKeys.has(key)) continue;
    planKeys.add(key);
    plans.push({
      plan_name: planName,
      year: String(year),
      railway: RAILWAY_CODES[unit],
      inspection_type: INSPECTION_TYPE_MAP[inspection] || '1',
      business: pick(BUSINESS_CODES),
      planned_count: randomInt(1, 8),
    });
    added++;
  }

  return plans;
}

function main() {
  const TOTAL_ISSUES = 1000;
  const TOTAL_PLANS = 100;
  const years = [112, 113, 114];
  const usedNumbers = new Set();
  const items = [];

  for (let i = 0; i < TOTAL_ISSUES; i++) {
    const year = pick(years);
    items.push(generateItem(i, year, usedNumbers));
  }

  const issuesPath = path.join(__dirname, 'demo-issues.json');
  fs.writeFileSync(issuesPath, JSON.stringify(items, null, 2), 'utf8');
  console.log(`已產生 ${TOTAL_ISSUES} 筆開立事項假資料至 ${issuesPath}`);
  console.log('鐵路機構分布:', UNITS.map(u => `${u}: ${items.filter(x => x.unit === u).length}`).join(', '));
  console.log('列管狀態分布:', STATUSES.map(s => `${s}: ${items.filter(x => x.status === s).length}`).join(', '));
  console.log('多輪紀錄: 約', items.filter(x => x.rounds && x.rounds.length > 1).length, '筆有 2 次以上辦理/審查');

  const plans = generatePlans(years, TOTAL_PLANS);
  const plansPath = path.join(__dirname, 'demo-plans.json');
  fs.writeFileSync(plansPath, JSON.stringify(plans, null, 2), 'utf8');
  console.log(`\n已產生 ${plans.length} 筆檢查計畫假資料至 ${plansPath}`);
  console.log('年度分布:', years.map(y => `${y}: ${plans.filter(p => p.year === String(y)).length}`).join(', '));
}

main();
