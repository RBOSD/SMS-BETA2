# SMS 開立事項系統 — 完整模組化計畫

> 版本：1.0  
> 日期：2025-02-12  
> 部署環境：Vercel + Supabase

---

## 一、計畫目標與約束

### 1.1 目標
- 將 monolithic 程式碼拆分為模組化結構，提升維護性
- 不改變任何功能、圖示、版面、顏色、字體、字形

### 1.2 約束
| 項目 | 說明 |
|------|------|
| 功能 | 所有 API、登入、查詢、匯入、管理流程維持不變 |
| UI | 所有按鈕、圖示、版面配置、顏色、字體、字形完全相同 |
| 部署 | 維持 Vercel 單一 serverless function 部署方式 |
| 資料庫 | 維持 Supabase PostgreSQL，pool 單例、Session 表不變 |

---

## 二、目前架構概覽（模組化完成後）

```
SMS-BETA/
├── vercel.json              # 所有請求 → server.js
├── package.json
├── server.js                # 精簡入口
├── config/, db/, middleware/, routes/, utils/  # 後端模組
└── public/
    ├── index.html           # 主頁，各 view 由 switchView 動態載入
    ├── login.html
    ├── scripts.js           # 剩餘邏輯（與 js/*.js 並存）
    ├── styles.css           # 保留備援（實際使用 css/*.css）
    ├── css/
    │   ├── base.css
    │   ├── header.css
    │   ├── layout.css
    │   ├── components.css
    │   └── views.css
    ├── js/
    │   ├── core.js, utils.js, auth.js, navigation.js
    │   ├── dashboard.js, search-view.js, import-view.js
    │   ├── plans-view.js, users-view.js, calendar-view.js
    │   ├── modals.js, main.js
    │   └── ...
    └── views/
        ├── search-view.html
        ├── calendar-dashboard-view.html
        ├── import-view.html
        ├── plans-view.html
        └── users-view.html
```

### 2.1 server.js 主要區塊
- DNS、Pool、Session 初始化（1-130）
- 權限中間件 protectHtmlPages（133-213）
- DB helpers：isAdminUser、getUserGroupIds、canEditByOwnership 等（218-395）
- CSRF、requireAuth（397-471）
- API 速率限制（459-471）
- initDB（474-835）
- 登入/登出/變更密碼（1031-1170）
- Issues API（1202-1790）
- Groups API（1773-1879）
- Users API（1899-2192）
- Admin Logs API（2194-2325）
- Plans API（2327-2995）
- Plan Schedule API（3120-3588）
- Templates API（3378-3453）
- 匯出 app 給 Vercel（3625）

### 2.2 scripts.js 主要區塊
- 全域狀態、apiFetch、getCsrfToken、showToast（1-200）
- 工具函數 getKindLabel、getStatusBadge、validateDateFormat 等
- 協作編修、Editors Modal（190-310）
- 各 view 專用邏輯：searchView、importView、usersView、planCalendarView
- Drawer、Modal、編輯表單、圖表、批次處理

---

## 三、目標架構（完成後）

```
SMS-BETA/
├── vercel.json                    # 維持：dest → server.js
├── package.json
├── server.js                      # 精簡入口（~80 行）
├── config/
│   └── pool.js                    # Pool 單例（Supabase 專用）
├── db/
│   ├── init.js                    # initDB、session 表建立
│   └── helpers.js                 # isAdminUser、getUserGroupIds、canEditByOwnership 等
├── middleware/
│   ├── auth.js                    # requireAuth、requireAdmin、requireAdminOrManager
│   ├── csrf.js                    # getCsrfToken、verifyCsrf
│   ├── protect.js                 # protectHtmlPages、view 權限檢查
│   └── rateLimit.js               # loginLimiter、apiLimiter、geminiLimiter
├── routes/
│   ├── auth.js                    # POST /api/auth/login, logout, GET /api/auth/me, PUT profile, POST change-password
│   ├── issues.js                  # /api/issues/*, /api/issues/:id/editors, batch-delete, import
│   ├── plans.js                   # /api/plans/*, /api/plans/:id/editors, import
│   ├── schedule.js                # /api/plan-schedule, /api/plan-schedule/all, holidays
│   ├── users.js                   # /api/users/*, /api/groups/*
│   ├── admin.js                   # /api/admin/logs, action_logs, cleanup
│   ├── options.js                 # /api/options/plans, /api/plans/dashboard-stats
│   ├── templates.js               # /api/templates/*
│   └── misc.js                    # /api/csrf-token, /api/log, /api/gemini
├── utils/
│   ├── log.js                     # logAction、logError、writeToLogFile
│   ├── validation.js              # validatePassword
│   └── constants.js               # RAILWAY_CODES、INSPECTION_CODES、getNextAvailableScheduleSeq 等
└── public/
    ├── index.html
    ├── login.html
    ├── styles.css                 # 保持單檔 或 拆成 css/*.css
    ├── js/
    │   ├── core.js                # 全域狀態、apiFetch、getCsrfToken、showToast
    │   ├── utils.js               # escapeHtml、getKindLabel、getStatusBadge、validateDateFormat
    │   ├── auth.js                # logout、submitProfile、submitChangePassword
    │   ├── navigation.js         # switchView、onToggleSidebar
    │   ├── search-view.js        # 開立事項檢索、篩選、分頁、表格
    │   ├── dashboard.js           # 統計圖表 initCharts、updateCharts
    │   ├── import-view.js        # 資料管理、Word 匯入、批次建檔、事項修正
    │   ├── plans-view.js         # 檢查計畫、排程管理
    │   ├── users-view.js         # 後台管理、使用者、群組、日誌
    │   ├── calendar-view.js     # 檢查行程檢索、月曆
    │   ├── modals.js            # Drawer、Modal、協作編修、批次編輯
    │   └── main.js               # DOMContentLoaded、initListeners、initCharts
    └── views/
        └── (保持不變)
```

---

## 四、執行階段與順序

### 階段一：後端模組化（優先）✅ 已完成

| 步驟 | 內容 | 產出 | 驗證 |
|------|------|------|------|
| 1.1 | 建立 `config/pool.js` | pool 單例、sslConfig、pool.on('error') | 本機 `node -e "require('./config/pool')"` |
| 1.2 | 建立 `db/helpers.js` | 移出 isAdminUser、getUserGroupIds、canEditByOwnership 等 | 單元測試或手動 require |
| 1.3 | 建立 `db/init.js` | 移出 initDB | server.js 呼叫 initDB |
| 1.4 | 建立 `middleware/auth.js` | requireAuth、requireAdmin、requireAdminOrManager | 登入後呼叫受保護 API |
| 1.5 | 建立 `middleware/csrf.js` | getCsrfToken、verifyCsrf | 登入後 POST 請求 |
| 1.6 | 建立 `middleware/protect.js` | protectHtmlPages、view 權限 | 存取 /views/users-view.html |
| 1.7 | 建立 `middleware/rateLimit.js` | loginLimiter、apiLimiter、geminiLimiter | 觸發限流 |
| 1.8 | 建立 `utils/log.js` | logAction、logError、writeToLogFile | 執行操作後檢查日誌 |
| 1.9 | 建立 `utils/validation.js` | validatePassword | 登入錯誤密碼 |
| 1.10 | 建立 `utils/constants.js` | RAILWAY_CODES、INSPECTION_CODES、getNextAvailableScheduleSeq | 檢查計畫排程 |
| 1.11 | 建立 `routes/auth.js` | 登入、登出、個人資料、變更密碼 | 完整登入登出流程 |
| 1.12 | 建立 `routes/issues.js` | issues CRUD、editors、batch-delete、import | 開立事項檢索、編輯、匯入 |
| 1.13 | 建立 `routes/plans.js` | plans CRUD、editors、import | 檢查計畫管理 |
| 1.14 | 建立 `routes/schedule.js` | plan-schedule、holidays | 檢查行程 |
| 1.15 | 建立 `routes/users.js` | users、groups | 後台管理 |
| 1.16 | 建立 `routes/admin.js` | logs、action_logs、cleanup | 日誌管理 |
| 1.17 | 建立 `routes/options.js` | options/plans、dashboard-stats | 下拉選單、統計 |
| 1.18 | 建立 `routes/templates.js` | 範本下載、匯入 | 匯入範本 |
| 1.19 | 建立 `routes/misc.js` | csrf-token、log、gemini | 一般 API |
| 1.20 | 精簡 `server.js` | require 各模組、app.use、掛載路由 | 本機啟動、Vercel 部署測試 |

### 階段二：前端 JS 模組化 ✅ 已完成

| 步驟 | 內容 | 產出 | 驗證 |
|------|------|------|------|
| 2.1 | 建立 `js/core.js` | 全域變數、apiFetch、getCsrfToken、showToast、writeLog | 載入後 showToast 可用 |
| 2.2 | 建立 `js/utils.js` | escapeHtml、getKindLabel、getStatusBadge、validateDateFormat、parsePlanValue | 表格渲染正確 |
| 2.3 | 建立 `js/auth.js` | logout、submitProfile、submitChangePassword、togglePwdVisibility | 個人設定、登出 |
| 2.4 | 建立 `js/navigation.js` | switchView、onToggleSidebar | 切換頁面 |
| 2.5 | 建立 `js/dashboard.js` | initCharts、updateCharts、toggleDashboard | 統計圖表 |
| 2.6 | 建立 `js/search-view.js` | loadIssuesPage、applyFilters、renderDataTable、sortData、分頁 | 開立事項檢索 |
| 2.7 | 建立 `js/import-view.js` | setupImportListeners、Word 匯入、批次建檔、事項修正、plans 子 tab | 資料管理 |
| 2.8 | 建立 `js/plans-view.js` | loadPlansPage、排程管理 | 檢查計畫 |
| 2.9 | 建立 `js/users-view.js` | loadUsersPage、使用者 CRUD、群組、日誌 | 後台管理 |
| 2.10 | 建立 `js/calendar-view.js` | loadDashboardYearOptions、月曆、統計 | 檢查行程 |
| 2.11 | 建立 `js/modals.js` | Drawer、Modal、協作編修、批次編輯、預覽 | 開關 Drawer/Modal |
| 2.12 | 建立 `js/main.js` | DOMContentLoaded、initListeners、initCharts、initEditForm | 頁面載入 |
| 2.13 | 修改 `index.html` | 依序載入 js/*.js（先 core→utils→auth→...→main） | 全功能測試 |

### 階段三：CSS 模組化 ✅ 已完成

| 步驟 | 內容 | 產出 | 驗證 |
|------|------|------|------|
| 3.1 | 建立 `css/base.css` | :root、html、body、*、box-sizing | 版面無異 |
| 3.2 | 建立 `css/header.css` | .app-header、.brand、.user-menu | 頂列無異 |
| 3.3 | 建立 `css/layout.css` | .app-body、.filters-panel、.main-content | 側欄、主區無異 |
| 3.4 | 建立 `css/components.css` | .btn、.filter-input、.modal、.drawer、表格 | 元件無異 |
| 3.5 | 建立 `css/views.css` | 各 view 專用樣式 | 各頁無異 |
| 3.6 | 修改 `index.html` | 依序載入 css/*.css | 視覺完全相同 |

### 階段四：HTML 視圖 ✅ 已完成

| 步驟 | 內容 | 產出 | 驗證 |
|------|------|------|------|
| 4.1 | 將 searchView 內容抽出 | `views/search-view.html` | switchView 動態載入 |
| 4.2 | 修改 switchView | 加入 searchView 至 viewMap | 開立事項檢索載入正常 |

---

## 五、Vercel + Supabase 注意事項

### 5.1 Pool 單例
- 所有模組必須 `require('./config/pool')` 取得同一 pool
- 不得在 routes 或 middleware 中 `new Pool()`

### 5.2 Session Store
- `connect-pg-simple` 使用同一 pool
- session 表仍在 Supabase，結構不變

### 5.3 vercel.json
- 維持 `"dest": "server.js"`
- 無需新增 builds 或 routes

### 5.4 環境變數
- `DATABASE_URL`：Supabase 連線字串
- `SESSION_SECRET`：生產環境必設
- `GEMINI_API_KEY`：若有 AI 功能

---

## 六、測試檢查清單

### 6.1 後端
- [ ] 本機 `npm start` 可啟動
- [ ] 登入 / 登出
- [ ] 開立事項檢索、篩選、分頁、排序
- [ ] 開立事項編輯、審查、刪除
- [ ] 資料管理：Word 匯入、批次建檔、事項修正
- [ ] 檢查計畫、排程管理
- [ ] 後台管理：使用者、群組、日誌
- [ ] 檢查行程檢索
- [ ] Vercel 部署後以上流程正常

### 6.2 前端
- [ ] 各 view 切換正常
- [ ] 圖表、表格、Modal、Drawer 顯示正確
- [ ] 無 console 錯誤
- [ ] 版面、顏色、字體與原本一致

---

## 七、回滾策略

- 每個階段完成後建立 git tag（例如 `phase1-backend-done`）
- 若模組化後出錯，可 `git checkout` 回上一階段
- 建議每完成一個 route 檔就 commit，方便追溯

---

## 八、預估工時（僅供參考）

| 階段 | 預估時間 |
|------|----------|
| 階段一：後端 | 8-12 小時 |
| 階段二：前端 | 12-16 小時 |
| 階段三：CSS | 2-4 小時 |
| 階段四：HTML | 1-2 小時 |
| 測試與修正 | 4-6 小時 |
| **合計** | **約 27-40 小時** |

---

## 九、附錄：模組依賴關係

### 後端
```
server.js
  └── config/pool.js
  └── db/init.js → config/pool
  └── db/helpers.js → config/pool
  └── middleware/auth.js → db/helpers
  └── middleware/csrf.js
  └── middleware/protect.js → db/helpers
  └── middleware/rateLimit.js
  └── utils/log.js
  └── utils/validation.js
  └── utils/constants.js
  └── routes/* → middleware、db/helpers、utils
```

### 前端
```
index.html
  ├── js/core.js
  ├── js/utils.js (依賴 core)
  ├── js/auth.js (依賴 core)
  ├── js/navigation.js (依賴 core)
  ├── js/dashboard.js (依賴 core)
  ├── js/search-view.js (依賴 core, utils)
  ├── js/import-view.js (依賴 core, utils)
  ├── js/plans-view.js (依賴 core, utils)
  ├── js/users-view.js (依賴 core, utils)
  ├── js/calendar-view.js (依賴 core)
  ├── js/modals.js (依賴 core, utils)
  └── js/main.js (依賴以上所有)
```

---

計畫結束。
