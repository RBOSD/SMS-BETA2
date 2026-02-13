# Cursor 內 GitHub 上傳設定指南

## 目前狀態

- **遠端倉庫**：https://github.com/RBOSD/SMS-BETA
- **Git 使用者**：deopkuo-bit (deop.kuo@gmail.com)
- **認證方式**：Windows 認證管理員 (credential.helper=manager)

---

## 步驟 1：登入 GitHub 帳號

1. 點擊 Cursor 左下角 **帳號圖示**（或 `Ctrl+Shift+P` 開啟命令面板）
2. 選擇 **「Sign in with GitHub」** 或 **「帳戶：登入」**
3. 在瀏覽器中完成 GitHub 授權
4. 確認 Cursor 左下角顯示已登入的 GitHub 帳號

---

## 步驟 2：使用 Source Control 上傳

1. 按 **`Ctrl+Shift+G`** 開啟 Source Control（原始檔控制）面板
2. 在「變更」區塊會列出已修改的檔案
3. 在訊息框輸入 commit 訊息
4. 點擊 **✓ 提交**（Commit）按鈕
5. 點擊 **「同步變更」** 或 **「推送」**（Push）按鈕

---

## 步驟 3：若遇到「推送被拒絕」

目前您的 `main` 分支與遠端有分歧（本地 1 個 commit，遠端 55 個 commit）。

**選項 A：先拉取再推送（建議）**
1. 在 Source Control 面板點擊 **「...」** 選單
2. 選擇 **「拉取」**（Pull）
3. 若有衝突，需手動解決
4. 完成後再點擊 **「推送」**

**選項 B：推送到新分支**
1. 點擊左下角分支名稱（main）
2. 選擇 **「建立新分支」**
3. 輸入分支名稱（例如：revert-sidebar）
4. 推送時會建立新分支，之後可在 GitHub 建立 Pull Request

---

## 步驟 4：若遇到認證問題

若推送時要求輸入帳號密碼或出現認證錯誤：

1. **重新設定認證**
   - 開啟 Windows「認證管理員」
   - 搜尋 `github.com`
   - 刪除舊的 GitHub 認證
   - 下次推送時會重新要求登入

2. **使用 Personal Access Token（建議）**
   - 前往 GitHub → Settings → Developer settings → Personal access tokens
   - 建立新 token，勾選 `repo` 權限
   - 推送時，密碼欄位貼上 token（不要用實際密碼）

---

## 步驟 5：檢查 Cursor 設定

確認以下設定已啟用（`檔案` → `喜好設定` → `設定`）：

| 設定 | 建議值 | 說明 |
|------|--------|------|
| `git.autofetch` | true | 自動取得遠端更新 |
| `git.enableSmartCommit` | true | 可一次提交所有變更 |
| `git.confirmSync` | false | 推送時不重複確認（可選） |

---

## 常見問題

### Q: 推送時顯示 "Permission denied" 或 "Authentication failed"
**A:** 確認您的 GitHub 帳號 (deopkuo-bit) 對 RBOSD/SMS-BETA 有寫入權限。若為組織倉庫，需由管理員授權。

### Q: 推送時顯示 "Updates were rejected"
**A:** 遠端有較新的 commit，需先執行「拉取」再推送。

### Q: Source Control 面板是空的
**A:** 確認專案資料夾已用 `git init` 初始化，且 Cursor 開啟的是專案根目錄。

### Q: 找不到「推送」按鈕
**A:** 需先完成至少一次「提交」，推送按鈕才會出現。或點擊「...」選單中的「推送」。

---

## 快速參考

| 操作 | 快捷鍵 |
|------|--------|
| 開啟 Source Control | `Ctrl+Shift+G` |
| 提交變更 | `Ctrl+Enter`（在 commit 訊息框內） |
| 命令面板 | `Ctrl+Shift+P` |
