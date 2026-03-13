/**
 * 開立事項與檢查計畫假資料載入器（獨立腳本，不 require 專案原始碼）
 * 使用方式：node load-demo-data.js
 * 前置：需先執行 node generate-demo-data.js 產生 demo-issues.json、demo-plans.json
 * 環境：需設定 .env 的 DATABASE_URL（與網站相同）
 * 展示完畢後可刪除此檔及 generate-demo-data.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const issuesPath = path.join(__dirname, 'demo-issues.json');
const plansPath = path.join(__dirname, 'demo-plans.json');

async function main() {
  if (!fs.existsSync(issuesPath)) {
    console.error('找不到 demo-issues.json，請先執行 node generate-demo-data.js');
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('請設定 .env 的 DATABASE_URL');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    const gRes = await client.query(
      "SELECT id FROM groups WHERE COALESCE(is_admin_group, false) = false ORDER BY id ASC LIMIT 1"
    );
    const ownerGroupId = gRes.rows[0]?.id;
    if (!ownerGroupId) {
      console.error('資料庫中無適用群組，請先建立群組');
      process.exit(1);
    }

    const uRes = await client.query("SELECT id FROM users ORDER BY id ASC LIMIT 1");
    const ownerUserId = uRes.rows[0]?.id || null;

    // 1. 載入檢查計畫（須先於開立事項，因事項會參照 plan_name）
    let plansInserted = 0;
    let plansSkipped = 0;
    if (fs.existsSync(plansPath)) {
      const plans = JSON.parse(fs.readFileSync(plansPath, 'utf8'));
      for (const p of plans) {
        const planName = (p.plan_name || p.name || '').trim();
        const year = String(p.year || '').trim();
        if (!planName || !year) continue;
        const exists = await client.query(
          "SELECT 1 FROM inspection_plan_schedule WHERE plan_name = $1 AND year = $2 LIMIT 1",
          [planName, year]
        );
        if (exists.rows.length > 0) {
          plansSkipped++;
          continue;
        }
        await client.query(
          `INSERT INTO inspection_plan_schedule (
            start_date, end_date, plan_name, year, railway, inspection_type, business, inspection_seq, plan_number, planned_count,
            owner_group_id, owner_group_ids, owner_user_id, edit_mode
          ) VALUES (NULL, NULL, $1, $2, $3, $4, $5, '00', '(手動)', $6, $7, $8, $9, $10)`,
          [
            planName,
            year,
            String(p.railway || 'T').toUpperCase(),
            String(p.inspection_type || '1'),
            p.business || null,
            p.planned_count != null ? parseInt(p.planned_count, 10) : null,
            ownerGroupId,
            [ownerGroupId],
            ownerUserId,
            'GROUP'
          ]
        );
        plansInserted++;
      }
      console.log(`檢查計畫：新增 ${plansInserted} 筆，略過已存在 ${plansSkipped} 筆`);
    } else {
      console.log('未找到 demo-plans.json，略過檢查計畫載入');
    }

    // 2. 載入開立事項
    const items = JSON.parse(fs.readFileSync(issuesPath, 'utf8'));
    let inserted = 0;
    let skipped = 0;

    for (const item of items) {
      const number = (item.number || '').trim();
      if (!number) continue;

      const exists = await client.query(
        "SELECT id FROM issues WHERE TRIM(number) = $1",
        [number]
      );
      if (exists.rows.length > 0) {
        skipped++;
        continue;
      }

      const cols = [
        'number', 'year', 'unit', 'content', 'status', 'item_kind_code', 'category',
        'division_name', 'inspection_category_name', 'handling', 'review',
        'plan_name', 'issue_date', 'reply_date_r1', 'response_date_r1',
        'owner_group_id', 'owner_group_ids', 'owner_user_id', 'edit_mode'
      ];
      const vals = [
        number,
        item.year || null,
        item.unit || null,
        item.content || '',
        item.status || '持續列管',
        item.itemKindCode || item.item_kind_code || null,
        item.category || null,
        item.divisionName || item.division_name || null,
        item.inspectionCategoryName || item.inspection_category_name || null,
        item.handling || '',
        item.review || '',
        item.planName || item.plan_name || null,
        item.issueDate || item.issue_date || null,
        item.replyDate || item.reply_date_r1 || '',
        item.responseDate || item.response_date_r1 || '',
        ownerGroupId,
        [ownerGroupId],
        ownerUserId,
        'GROUP'
      ];

      const extraCols = [];
      const extraVals = [];
      for (let r = 2; r <= 30; r++) {
        const h = item[`handling${r}`] ?? item.rounds?.[r - 1]?.handling;
        const rev = item[`review${r}`] ?? item.rounds?.[r - 1]?.review;
        const rd = item[`replyDate_r${r}`] ?? item.rounds?.[r - 1]?.replyDate;
        const resp = item[`responseDate_r${r}`] ?? item.rounds?.[r - 1]?.responseDate;
        if (h || rev || rd || resp) {
          extraCols.push(`handling${r}`, `review${r}`, `reply_date_r${r}`, `response_date_r${r}`);
          extraVals.push(h || '', rev || '', rd || '', resp || '');
        }
      }

      const allCols = [...cols, ...extraCols];
      const allVals = [...vals, ...extraVals];
      const placeholders = allVals.map((_, i) => `$${i + 1}`).join(', ');

      await client.query(
        `INSERT INTO issues (${allCols.join(', ')}) VALUES (${placeholders})`,
        allVals
      );
      inserted++;
      if (inserted % 100 === 0) process.stdout.write('.');
    }

    console.log(`開立事項：新增 ${inserted} 筆，略過已存在 ${skipped} 筆`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
