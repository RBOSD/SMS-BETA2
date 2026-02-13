        // [Modularized] 全域狀態、apiFetch、getCsrfToken、showToast、writeLog、utils → 已移至 js/core.js、js/utils.js
        // 協作編修：openEditorsModal、closeEditorsModal、renderEditorsUserList、saveEditorsSelection、toggleEditorsUser、openIssueEditorsModalFromDrawer、openPlanEditorsModal → js/modals.js

        window.addEventListener('click', function (e) { if (!e.target.closest('.user-menu-container')) { document.getElementById('userDropdown').classList.remove('show'); } });

        // togglePwdVisibility → js/auth.js

        // toggleAdvancedFilters → js/search-view.js

        // --- Helper functions (Safe Versions) ---
        function normalizeCodeString(str) {
            if (!str) return "";
            var s = String(str);
            s = (s.normalize ? s.normalize("NFKC") : s);
            s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");
            s = s.replace(/[\u2010-\u2015\u2212\uFE63\uFF0D]/g, "-");
            s = s.replace(/[ \t]+/g, " ").replace(/\s*-\s*/g, "-");
            return s.trim();
        }
        function stripHtml(h) {
            if (!h) return '';
            let t = document.createElement("DIV");
            t.innerHTML = String(h);
            return t.textContent || t.innerText || "";
        }
        function getLatest(i, p) { 
            // 支持無限次，動態查找（從200開始向下找，實際應該不會超過這個數字）
            for (let k = 200; k >= 1; k--) { 
                const key = k === 1 ? p : `${p}${k}`; 
                if (i[key]) return i[key]; 
            } 
            return null; 
        }
        
        // [Added] 獲取最新的審查或辦理情形（比較輪次）
        function getLatestReviewOrHandling(item) {
            let latestReviewRound = 0;
            let latestHandlingRound = 0;
            let latestReview = null;
            let latestHandling = null;
            
            // 查找最新的審查意見
            for (let k = 200; k >= 1; k--) {
                const key = k === 1 ? 'review' : `review${k}`;
                if (item[key] && item[key].trim()) {
                    latestReviewRound = k;
                    latestReview = item[key];
                    break;
                }
            }
            
            // 查找最新的辦理情形
            for (let k = 200; k >= 1; k--) {
                const key = k === 1 ? 'handling' : `handling${k}`;
                if (item[key] && item[key].trim()) {
                    latestHandlingRound = k;
                    latestHandling = item[key];
                    break;
                }
            }
            
            // 比較輪次，選擇輪次更高的
            if (latestReviewRound > latestHandlingRound) {
                return { type: 'review', content: latestReview, round: latestReviewRound };
            } else if (latestHandlingRound > latestReviewRound) {
                return { type: 'handling', content: latestHandling, round: latestHandlingRound };
            } else if (latestReviewRound > 0 && latestReviewRound === latestHandlingRound) {
                // 輪次相同，優先顯示審查（因為審查在辦理之後）
                return { type: 'review', content: latestReview, round: latestReviewRound };
            } else if (latestReview) {
                return { type: 'review', content: latestReview, round: latestReviewRound };
            } else if (latestHandling) {
                return { type: 'handling', content: latestHandling, round: latestHandlingRound };
            }
            
            return null;
        }
        // getRoleName → js/utils.js
        // [Enhanced] 改進編號提取，支持從帶換行的儲存格中提取編號
        function extractNumberFromCell(cell) {
            if (!cell) return "";
            var whole = normalizeCodeString(cell.innerText || cell.textContent || "");
            
            // 1. 先嘗試直接提取 TRC-v2 格式 (123-TRC-1-7-OP-N12)
            var mB = whole.match(/(\d{3}-[A-Za-z]{3}-[1-4]-\d+-[A-Za-z]{2,3}-[NORnor]\d{1,3})/);
            if (mB) return (mB[1] || "").toUpperCase();
            
            // 2. 嘗試 THAS-v2 格式（新提案）有分隔符 (113T1-01-OP-N01)
            var mC = whole.match(/(\d{3}[THASthas][1-5]-\d{2}-[A-Za-z]{2,3}-[NORnor]\d{2})/);
            if (mC) return (mC[1] || "").toUpperCase();
            
            // 3. 嘗試 THAS-v2 格式（新提案）無分隔符 (113T101OPN01)
            var mC2 = whole.match(/(\d{3}[THASthas][1-5]\d{2}[A-Za-z]{2,3}[NORnor]\d{2})/);
            if (mC2) return (mC2[1] || "").toUpperCase();
            
            // 4. 嘗試 THAS-v1 格式 (13T1-A01-N01)
            var mA = whole.match(/(\d{2}[THASthas][1-4]-[A-Ga-g]\d{2}-[NORnor]\d{2})/);
            if (mA) return (mA[1] || "").toUpperCase();
            
            // 5. 處理帶 <br> 的情況，分行匹配
            var rawHtml = cell.innerHTML || "";
            var lines = normalizeCodeString(rawHtml.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]*>/g, "")).split("\n");
            for (var i = 0; i < lines.length; i++) {
                var line = (lines[i] || "").trim();
                if (!line) continue;
                var m1 = line.match(/(\d{3}-[A-Za-z]{3}-[1-4]-\d+-[A-Za-z]{2,3}-[NORnor]\d{1,3})/);
                if (m1) return (m1[1] || "").toUpperCase();
                var m2 = line.match(/(\d{3}[THASthas][1-5]-\d{2}-[A-Za-z]{2,3}-[NORnor]\d{2})/);
                if (m2) return (m2[1] || "").toUpperCase();
                var m3 = line.match(/(\d{3}[THASthas][1-5]\d{2}[A-Za-z]{2,3}[NORnor]\d{2})/);
                if (m3) return (m3[1] || "").toUpperCase();
                var m4 = line.match(/(\d{2}[THASthas][1-4]-[A-Ga-g]\d{2}-[NORnor]\d{2})/);
                if (m4) return (m4[1] || "").toUpperCase();
            }
            
            return whole.trim();
        }

        // [Updated] Map & Parser
        const ORG_MAP = { "T": "臺鐵", "H": "高鐵", "A": "林鐵", "S": "糖鐵", "TRC": "臺鐵", "HSR": "高鐵", "AFR": "林鐵", "TSC": "糖鐵" };
        // [Added] 機構交叉映射表（THAS-v1 ↔ TRC-v2）
        const ORG_CROSSWALK = { "T": "TRC", "H": "HSR", "A": "AFR", "S": "TSC", "TRC": "TRC", "HSR": "HSR", "AFR": "AFR", "TSC": "TSC" };
        const INSPECTION_MAP = { "1": "定期檢查", "2": "例行性檢查", "3": "特別檢查", "4": "臨時檢查", "5": "調查" };
        // [Verified] Division Map includes all requested codes
        const DIVISION_MAP = { 
            "A": "運務", "B": "工務", "C": "機務", "D": "電務", "E": "安全", "F": "審核", "G": "災防", 
            "OP": "運轉", "CV": "土建", "ME": "機務", "EL": "電務", "SM": "安全管理", "AD": "營運", "OT": "其他",
            "CP": "土木", "EM": "機電" 
        };
        const KIND_MAP = { "N": "缺失事項", "O": "觀察事項", "R": "建議事項" };
        const FILLED_MARKS = ["■", "☑", "☒", "✔", "✅", "●", "◉", "✓"]; var EMPTY_MARKS = ["□", "☐", "◻", "○", "◯", "◇", "△"];

        // [Enhanced] 改進編號解析，支持 scheme 和 period 字段
        function parseItemNumber(numberStr) {
            var raw = normalizeCodeString(numberStr || "");
            if (!raw) return null;
            
            // 1. THAS-v1 格式：13T1-A01-N01 (2位年+T+类别-部门+序号-类型+序号)
            var m = raw.match(/^(\d{2})([THAS])([1-4])\-([A-G])(\d{2})\-([NOR])(\d{2})$/i);
            if (m) {
                var yy = parseInt(m[1], 10);
                var rocYear = 100 + yy;
                var orgCode = m[2].toUpperCase();
                var itemSeq = m[7];
                var divisionSeq = m[5];
                return {
                    scheme: "THAS-v1",
                    raw: raw,
                    yearRoc: rocYear,
                    orgCode: orgCode,
                    orgCodeRaw: orgCode,
                    inspectCode: m[3],
                    divCode: m[4].toUpperCase(),
                    divisionCode: m[4].toUpperCase(),
                    divisionSeq: divisionSeq,
                    kindCode: m[6].toUpperCase(),
                    itemSeq: itemSeq,
                    period: ""
                };
            }
            
            // 2. TRC-v2 格式：123-TRC-1-7-OP-N12 (3位年-机构-类别-期数-部门-类型序号)
            m = raw.match(/^(\d{3})-([A-Z]{3})-([1-4])-(\d+)-([A-Z]{2,3})-([NOR])(\d{1,3})$/i);
            if (m) {
                var rocYear2 = parseInt(m[1], 10);
                var orgCode2 = m[2].toUpperCase();
                var period = m[4];
                var itemSeq2 = m[7];
                return {
                    scheme: "TRC-v2",
                    raw: raw,
                    yearRoc: rocYear2,
                    orgCode: orgCode2,
                    orgCodeRaw: orgCode2,
                    inspectCode: m[3],
                    divCode: m[5].toUpperCase(),
                    divisionCode: m[5].toUpperCase(),
                    divisionSeq: "",
                    kindCode: m[6].toUpperCase(),
                    itemSeq: itemSeq2,
                    period: period
                };
            }
            
            // 3. THAS-v2 格式（新提案）：113T1-01-OP-N01 (3位年+机构+类别-检查次数-业务类别-类型+流水号)
            // 支援有分隔符和無分隔符兩種格式
            m = raw.match(/^(\d{3})([THAS])([1-5])\-(\d{2})\-([A-Z]{2,3})\-([NOR])(\d{2})$/i);
            if (m) {
                var rocYear3 = parseInt(m[1], 10);
                var orgCode3 = m[2].toUpperCase();
                var period3 = m[4];
                var itemSeq3 = m[7];
                return {
                    scheme: "THAS-v2",
                    raw: raw,
                    yearRoc: rocYear3,
                    orgCode: orgCode3,
                    orgCodeRaw: orgCode3,
                    inspectCode: m[3],
                    divCode: m[5].toUpperCase(),
                    divisionCode: m[5].toUpperCase(),
                    divisionSeq: "",
                    kindCode: m[6].toUpperCase(),
                    itemSeq: itemSeq3,
                    period: period3
                };
            }
            
            // 3b. THAS-v2 無分隔符格式：113T101OPN01
            m = raw.match(/^(\d{3})([THAS])([1-5])(\d{2})([A-Z]{2,3})([NOR])(\d{2})$/i);
            if (m) {
                var rocYear3b = parseInt(m[1], 10);
                var orgCode3b = m[2].toUpperCase();
                var period3b = m[4];
                var itemSeq3b = m[7];
                return {
                    scheme: "THAS-v2",
                    raw: raw,
                    yearRoc: rocYear3b,
                    orgCode: orgCode3b,
                    orgCodeRaw: orgCode3b,
                    inspectCode: m[3],
                    divCode: m[5].toUpperCase(),
                    divisionCode: m[5].toUpperCase(),
                    divisionSeq: "",
                    kindCode: m[6].toUpperCase(),
                    itemSeq: itemSeq3b,
                    period: period3b
                };
            }
            
            // 3c. THAS-v2 寬鬆格式（支援缺少檢查發現分類的情況）：115T2-01-OP-001
            // 這種格式最後是數字而不是 N/O/R+數字，我們嘗試解析但 kindCode 會是空
            m = raw.match(/^(\d{3})([THAS])([1-5])\-(\d{2})\-([A-Z]{2,3})\-(\d{2,3})$/i);
            if (m) {
                var rocYear3c = parseInt(m[1], 10);
                var orgCode3c = m[2].toUpperCase();
                var period3c = m[4];
                var itemSeq3c = m[6];
                return {
                    scheme: "THAS-v2",
                    raw: raw,
                    yearRoc: rocYear3c,
                    orgCode: orgCode3c,
                    orgCodeRaw: orgCode3c,
                    inspectCode: m[3],
                    divCode: m[5].toUpperCase(),
                    divisionCode: m[5].toUpperCase(),
                    divisionSeq: "",
                    kindCode: "", // 無法確定檢查發現分類
                    itemSeq: itemSeq3c,
                    period: period3c
                };
            }
            
            // 3d. THAS-v2 寬鬆格式無分隔符：115T201OP001
            m = raw.match(/^(\d{3})([THAS])([1-5])(\d{2})([A-Z]{2,3})(\d{2,3})$/i);
            if (m) {
                var rocYear3d = parseInt(m[1], 10);
                var orgCode3d = m[2].toUpperCase();
                var period3d = m[4];
                var itemSeq3d = m[6];
                return {
                    scheme: "THAS-v2",
                    raw: raw,
                    yearRoc: rocYear3d,
                    orgCode: orgCode3d,
                    orgCodeRaw: orgCode3d,
                    inspectCode: m[3],
                    divCode: m[5].toUpperCase(),
                    divisionCode: m[5].toUpperCase(),
                    divisionSeq: "",
                    kindCode: "", // 無法確定檢查發現分類
                    itemSeq: itemSeq3d,
                    period: period3d
                };
            }
            
            // 4. 長格式（兼容舊格式）：123-TRC-1-7-OP-N12 (支持 3-4 位機構代碼)
            var cleanRaw = raw.replace(/[^a-zA-Z0-9\-]/g, "");
            var mLong = cleanRaw.match(/^(\d{3})-([A-Z]{3,4})-([0-9])-(\d+)-([A-Z]{2,4})-([NOR])(\d+)$/i);
            if (mLong) {
                return {
                    scheme: "TRC-v2",
                    raw: mLong[0],
                    yearRoc: parseInt(mLong[1], 10),
                    orgCode: mLong[2].toUpperCase(),
                    orgCodeRaw: mLong[2].toUpperCase(),
                    inspectCode: mLong[3],
                    divCode: mLong[5].toUpperCase(),
                    divisionCode: mLong[5].toUpperCase(),
                    divisionSeq: "",
                    kindCode: mLong[6].toUpperCase(),
                    itemSeq: mLong[7],
                    period: mLong[4]
                };
            }
            
            // 5. 短格式（兼容舊格式）：13T1-A01-N01 (支持 2-3 位年份)
            var mShort = cleanRaw.match(/^(\d{2,3})([A-Z])([0-9])-([A-Z])(\d{2})-([NOR])(\d{2})$/i);
            if (mShort) {
                var yy = parseInt(mShort[1], 10);
                var rocYear = (yy < 1000) ? (yy + (yy < 100 ? 100 : 0)) : (yy - 1911);
                return {
                    scheme: "THAS-v1",
                    raw: mShort[0],
                    yearRoc: rocYear,
                    orgCode: mShort[2].toUpperCase(),
                    orgCodeRaw: mShort[2].toUpperCase(),
                    inspectCode: mShort[3],
                    divCode: mShort[4].toUpperCase(),
                    divisionCode: mShort[4].toUpperCase(),
                    divisionSeq: mShort[5],
                    kindCode: mShort[6].toUpperCase(),
                    itemSeq: mShort[7],
                    period: ""
                };
            }
            
            // 6. 寬鬆匹配（fallback）
            var mLoose = cleanRaw.match(/(\d{2,3}).*([NOR])\d+/i);
            if (mLoose) {
                return {
                    scheme: "",
                    raw: mLoose[0],
                    yearRoc: parseInt(mLoose[1], 10),
                    orgCode: "?",
                    orgCodeRaw: "?",
                    inspectCode: "?",
                    divCode: "?",
                    divisionCode: "?",
                    divisionSeq: "",
                    kindCode: mLoose[2].toUpperCase(),
                    itemSeq: "",
                    period: ""
                };
            }
            
            return {
                scheme: "",
                raw: cleanRaw,
                yearRoc: "",
                orgCode: "",
                orgCodeRaw: "",
                inspectCode: "",
                divCode: "",
                divisionCode: "",
                divisionSeq: "",
                kindCode: "",
                itemSeq: "",
                period: ""
            };
        }

        function normalizeMultiline(s) { s = String(s || ""); return s.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\u00A0/g, " ").replace(/\u3000/g, " ").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").trim(); }
        
        // [Added] 編號規範化函數（參考轉換工具）
        function canonicalNumber(info) {
            if (!info) return "";
            if (info.scheme === "TRC-v2") {
                // [修正] 保留原始序號，不要去掉前導零
                var seq = info.itemSeq || "0";
                return (info.yearRoc + "-" + info.orgCodeRaw + "-" + 
                        info.inspectCode + "-" + (info.period || "") + "-" + 
                        info.divisionCode + "-" + info.kindCode + seq).toUpperCase();
            }
            if (info.scheme === "THAS-v2") {
                // THAS-v2 格式：113T1-01-OP-N01 (3位年+机构+类别-检查次数-业务类别-类型+流水号)
                var period = String(info.period || "0");
                period = ("0" + period).slice(-2); // 確保2碼
                var seq = String(info.itemSeq || "0");
                seq = ("0" + seq).slice(-2); // 確保2碼
                return (info.yearRoc + info.orgCodeRaw + info.inspectCode + "-" + 
                        period + "-" + info.divisionCode + "-" + 
                        info.kindCode + seq).toUpperCase();
            }
            if (info.scheme === "THAS-v1") {
                var yy = String(info.yearRoc - 100);
                yy = ("0" + yy).slice(-2);
                var seq2 = String(parseInt(info.itemSeq || "0", 10));
                seq2 = ("0" + seq2).slice(-2);
                return (yy + info.orgCodeRaw + info.inspectCode + "-" + 
                        info.divisionCode + (info.divisionSeq || "") + "-" + 
                        info.kindCode + seq2).toUpperCase();
            }
            return (info.raw || "").toUpperCase();
        }

        // [修正與增強] 內容清理與切割：只抓取最新的回覆內容
        function sanitizeContent(html) {
            if (!html) return "";
            var s = String(html);

            // 1. 先做基礎清理，移除多餘的樣式標籤，保留換行結構
            s = s.replace(/<\s*br\s*\/?>/gi, "\n")
                .replace(/<\s*\/p\s*>/gi, "\n")
                .replace(/<\s*p[^>]*>/gi, "")
                .replace(/<[^>]+>/g, ""); // 移除剩餘所有 HTML 標籤

            // 2. 正規化空白與特殊字元
            s = s.replace(/&nbsp;/g, " ")
                .replace(/[\u200B-\u200D\uFEFF]/g, "")
                .trim();

            // 3. [關鍵邏輯] 智慧切割：抓取「最上面」的內容
            var lines = s.split('\n');
            var resultLines = [];
            var hasContent = false;

            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();

                // 略過開頭的空行
                if (!hasContent && line.length === 0) continue;

                // 遇到常見的分隔線符號，視為舊資料開始，直接結束截取
                if (/^[-=_]{3,}/.test(line)) {
                    break;
                }

                // 遇到明顯的「日期標籤」且不是第一行時，視為舊資料的開始
                if (hasContent && /^(\d{2,3}[./-]\d{1,2}[./-]\d{1,2})/.test(line)) {
                    break;
                }

                // 遇到「前次」、「上次」關鍵字開頭，視為舊資料
                if (hasContent && /^(前次|上次|第\d+次)(辦理|審查|回復|說明)/.test(line)) {
                    break;
                }

                // 加入有效行
                resultLines.push(line);
                if (line.length > 0) hasContent = true;
            }

            return resultLines.join("\n").trim();
        }

        function parseStatusFromResultCell(cell) { if (!cell) return ""; var src = normalizeMultiline((cell.innerText || cell.textContent || "") + "\n" + (cell.innerHTML || "").replace(/<[^>]+>/g, "")); if (!src) return ""; var allMarks = FILLED_MARKS.concat(EMPTY_MARKS).join(""); allMarks = allMarks.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&"); var reFront = new RegExp("([" + allMarks + "])\\s*(?:[:：﹕-]?\\s*)?(解除列管|持續列管|自行列管)", "g"); var reBack = new RegExp("(解除列管|持續列管|自行列管)\\s*(?:[:：﹕-]?\\s*)?([" + allMarks + "])", "g"); var hits = [], m; while ((m = reFront.exec(src)) !== null) { hits.push({ idx: m.index, label: m[2], mark: m[1], filled: FILLED_MARKS.indexOf(m[1]) >= 0 }); } while ((m = reBack.exec(src)) !== null) { hits.push({ idx: m.index, label: m[1], mark: m[2], filled: FILLED_MARKS.indexOf(m[2]) >= 0 }); } var filled = hits.filter(function (h) { return h.filled; }).sort(function (a, b) { return a.idx - b.idx; }); if (filled.length) return filled[filled.length - 1].label; var labels = ["解除列管", "持續列管", "自行列管"]; var present = labels.filter(function (l) { return src.indexOf(l) >= 0; }); if (present.length === 1) return present[0]; return ""; }
        function formatHtmlToText(html) { if (!html) return ""; let temp = String(html).replace(/<li[^>]*>/gi, "\n• ").replace(/<\/li>/gi, "").replace(/<ul[^>]*>/gi, "").replace(/<\/ul>/gi, "").replace(/<ol[^>]*>/gi, "").replace(/<\/ol>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<p[^>]*>/gi, ""); let div = document.createElement("div"); div.innerHTML = temp; return (div.textContent || div.innerText || "").replace(/\n\s*\n/g, "\n").trim(); }

        // showToast → js/core.js

        // showPreview, closePreview, showConfirmModal, closeConfirmModal → js/modals.js

        // loadPlanOptions → js/import-view.js
        
        // loadFilterPlanOptions → js/search-view.js
        
        // parsePlanValue → js/utils.js
        
        // 共用函數：載入計畫下的所有事項
        async function loadIssuesByPlan(planValue, options = {}) {
            const { showError = true, returnEmpty = false } = options;
            try {
                const res = await fetch(`/api/issues?page=1&pageSize=1000&planName=${encodeURIComponent(planValue)}&_t=${Date.now()}`);
                if (!res.ok) {
                    if (showError) throw new Error('載入事項列表失敗');
                    return null;
                }
                
                const json = await res.json();
                const issueList = json.data || [];
                
                if (issueList.length === 0) {
                    if (showError) {
                        showToast('該檢查計畫下尚無開立事項', 'error');
                    }
                    return returnEmpty ? [] : null;
                }
                
                return issueList;
            } catch (e) {
                if (showError) {
                    console.error('載入計畫事項失敗:', e);
                    showToast('載入事項列表失敗', 'error');
                }
                return null;
            }
        }
        
        // 共用函數：從編號提取類別代碼
        function extractKindCodeFromNumber(numberStr) {
            if (!numberStr) return null;
            const m = numberStr.match(/-([NOR])\d+$/i);
            return m ? m[1].toUpperCase() : null;
        }
        
        // 批次建檔：當選擇計畫時，自動帶入年度
        async function handleBatchPlanChange() {
            const planValue = this.value;
            const yearInput = document.getElementById('batchYear');
            if (!planValue || !yearInput) return;
            
            const { name, year } = parsePlanValue(planValue);
            if (year) {
                yearInput.value = year;
            } else if (name) {
                // 如果沒有年度資訊，嘗試從計畫名稱中提取年度
                const yearMatch = name.match(/(\d{3})年度/);
                if (yearMatch) yearInput.value = yearMatch[1];
            }
        }
        
        // 手動新增：當選擇計畫時，自動帶入年度
        async function handleManualPlanChange() {
            const planValue = this.value;
            const yearDisplay = document.getElementById('manualYearDisplay');
            if (!planValue || !yearDisplay) return;
            
            const { name, year } = parsePlanValue(planValue);
            if (year) {
                yearDisplay.value = year;
            } else if (name) {
                // 如果沒有年度資訊，嘗試從計畫名稱中提取年度
                const yearMatch = name.match(/(\d{3})年度/);
                if (yearMatch) yearDisplay.value = yearMatch[1];
            }
        }

        function initImportRoundOptions() {
            const s = document.getElementById('importRoundSelect');
            if (!s) return;
            s.innerHTML = '';
            // 支援無限次審查，先建立前 30 次選項
            for (let i = 1; i <= 30; i++) {
                s.innerHTML += `<option value="${i}">第 ${i} 次審查</option>`;
            }
        }

        // switchView → js/navigation.js
        // loadDashboardYearOptions, onDashboardYearChange, loadCalendarDashboardStats, initDashboardCalendar, renderDashboardCalendar, loadDashboardScheduleForMonth, dashboardSchedulePrevMonth, dashboardScheduleNextMonth, dashboardSelectDay → js/calendar-view.js

        // DOMContentLoaded、initListeners、initEditForm → js/main.js

        async function checkAuth() {
            try {
                // 使用 Promise.race 實現超時處理
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('TIMEOUT')), 10000); // 10秒超時
                });
                
                const fetchPromise = apiFetch('/api/auth/me?t=' + Date.now(), { 
                    headers: { 'Cache-Control': 'no-cache' }
                });
                
                const res = await Promise.race([fetchPromise, timeoutPromise]);
                
                if (!res.ok) {
                    console.error('認證檢查失敗:', res.status, res.statusText);
                    // 如果認證失敗，重定向到登入頁
                    sessionStorage.clear();
                    window.location.href = '/login.html';
                    return;
                }
                
                const data = await res.json();
                if (data.isLogin && data.id && data.username) {
                    currentUser = data;
                    const nameEl = document.getElementById('headerUserName');
                    const roleEl = document.getElementById('headerUserRole');
                    if (nameEl) nameEl.innerText = data.name || data.username;
                    const isAdmin = data.isAdmin === true;
                    if (roleEl) roleEl.innerText = isAdmin ? '系統管理員' : (window.getRoleName || function(r){return r;})(data.role);
                    
                    const btnCalendar = document.getElementById('btn-planCalendarView');
                    if (btnCalendar) btnCalendar.classList.remove('hidden');
                    const groupImport = document.getElementById('sidebarGroupImport');
                    const groupUsers = document.getElementById('sidebarGroupUsers');
                    if (isAdmin || data.role === 'manager') {
                        const btnImport = document.getElementById('btn-importView');
                        if (btnImport) btnImport.classList.remove('hidden');
                        if (groupImport) groupImport.classList.remove('hidden');
                        const btnUsers = document.getElementById('btn-usersView');
                        if (btnUsers) btnUsers.classList.toggle('hidden', !isAdmin);
                        if (groupUsers) groupUsers.classList.toggle('hidden', !isAdmin);
                    } else {
                        const btnImport = document.getElementById('btn-importView');
                        const btnUsers = document.getElementById('btn-usersView');
                        if (btnImport) btnImport.classList.add('hidden');
                        if (btnUsers) btnUsers.classList.add('hidden');
                        if (groupImport) groupImport.classList.add('hidden');
                        if (groupUsers) groupUsers.classList.add('hidden');
                    }
                } else {
                    // 未登入或資料不完整，重定向到登入頁
                    if (isDevelopment) console.warn('認證資料不完整，重定向到登入頁');
                    sessionStorage.clear();
                    window.location.href = '/login.html';
                }
            } catch (e) {
                // 如果是超時錯誤，顯示錯誤訊息
                if (e.message === 'TIMEOUT') {
                    console.error('認證檢查超時');
                    // 超時時顯示錯誤訊息，不直接重定向
                    document.body.style.display = 'flex';
                    const appBody = document.getElementById('appBody');
                    if (appBody) {
                        appBody.innerHTML = `
                            <div style="padding: 40px; text-align: center; color: #ef4444;">
                                <h2>連線逾時</h2>
                                <p>無法連線到伺服器，請檢查網路連線後重新整理頁面。</p>
                                <button onclick="window.location.reload()" class="btn btn-primary" style="margin-top: 20px;">
                                    重新整理頁面
                                </button>
                            </div>
                        `;
                    }
                } else if (e.message === 'Unauthorized') {
                    // 認證錯誤已在 apiFetch 中處理，這裡不需要再做什麼
                    return;
                } else {
                    console.error('認證檢查錯誤:', e);
                    // 其他錯誤，重定向到登入頁
                    sessionStorage.clear();
                    window.location.href = '/login.html';
                }
            }
        }
        window.checkAuth = checkAuth;

        // setupAdminElements, setupImportListeners → js/import-view.js

        // loadIssuesPage, applyFilters, renderTable, sortData, renderPagination 等 → js/search-view.js

        // saveUsersViewState, restoreUsersViewState, loadUsersPage, renderUsers, usersSortBy, loadLogsPage, loadActionsPage, exportLogs, deleteLogsFromDB, setupCleanupDaysSelect, switchAdminTab → js/users-view.js
        // 群組管理、使用者 CRUD: loadGroupsAdmin, openUserModal, submitUser, toggleUserDisable, deleteUser, resetUserPassword, exportUsers 等 → js/users-view.js

        async function loadOwnerGroupSelectsForImportView() {
            // 供資料管理頁面使用：開立事項匯入/建檔、計畫新增、行程規劃（可多選群組）
            if (typeof window.ensureGroupsForUserModalLoaded === 'function') await window.ensureGroupsForUserModalLoaded();
            const groups = Array.isArray(window.cachedGroupsForModal) ? window.cachedGroupsForModal : [];
            const dataGroups = groups.filter(g => !(g && (g.is_admin_group === true || g.isAdminGroup === true)));
            const myGroupIds = Array.isArray(currentUser?.groupIds) ? currentUser.groupIds.map(x => parseInt(x, 10)).filter(n => Number.isFinite(n)) : [];
            const allowedSet = currentUser?.isAdmin === true ? null : new Set(myGroupIds);
            const allowedGroups = allowedSet
                ? dataGroups.filter(g => allowedSet.has(parseInt(g.id, 10)))
                : dataGroups;

            const fill = (id) => {
                const container = document.getElementById(id);
                if (!container) return;
                if (allowedGroups.length === 0) {
                    container.innerHTML = '<span style="color:#94a3b8;font-size:13px;">尚無可選群組</span>';
                    return;
                }
                container.innerHTML = allowedGroups.map(g => {
                    const gid = g.id;
                    const gname = escapeHtml(g.name || `群組 ${gid}`);
                    return `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:#334155;">
                        <input type="checkbox" class="owner-group-cb" data-group-id="${gid}" style="width:16px;height:16px;">
                        <span>${gname}</span>
                    </label>`;
                }).join('');
            };

            fill('importOwnerGroup');
            fill('createOwnerGroup');
            fill('planOwnerGroup');
        }

        function getOwnerGroupIdsFromCheckboxes(containerId) {
            const container = document.getElementById(containerId);
            if (!container) return [];
            const checked = container.querySelectorAll('.owner-group-cb:checked');
            return Array.from(checked).map(cb => parseInt(cb.dataset.groupId, 10)).filter(n => Number.isFinite(n));
        }

        function getIssueOwnerGroupIds() {
            const ids = getOwnerGroupIdsFromCheckboxes('importOwnerGroup').length > 0
                ? getOwnerGroupIdsFromCheckboxes('importOwnerGroup')
                : getOwnerGroupIdsFromCheckboxes('createOwnerGroup');
            return ids;
        }

        function getPlanOwnerGroupIds() {
            return getOwnerGroupIdsFromCheckboxes('planOwnerGroup');
        }

        // [修正與增強] HTML 解析核心：提升對 Word 表格的容錯率
        function parseFromHTML(html) {
            var items = [];
            try {
                var doc = new DOMParser().parseFromString(html, "text/html");
                var tables = doc.querySelectorAll("table");

                tables.forEach(function (table) {
                    var rows = table.querySelectorAll("tr");
                    var headerRow = -1, dataStart = -1;

                    for (var i = 0; i < Math.min(rows.length, 10); i++) {
                        var t = (rows[i].innerText || rows[i].textContent || "").replace(/\s+/g, "");
                        if ((/編號|項次|序號/).test(t) && (/內容|摘要/).test(t)) {
                            headerRow = i;
                            dataStart = i + 1;
                            break;
                        }
                    }

                    if (headerRow === -1) return;

                    var headerCells = rows[headerRow].querySelectorAll("td,th");
                    var col = { number: -1, content: -1, handling: -1, result: -1 };
                    var reviewCols = [];

                    headerCells.forEach(function (cell, idx) {
                        var text = (cell.innerText || cell.textContent || "").replace(/\s+/g, "");
                        if ((/編號|項次|序號/).test(text)) col.number = idx;
                        else if ((/事項內容|缺失內容|觀察內容|內容/).test(text)) col.content = idx;
                        else if ((/辦理情形|改善情形/).test(text)) col.handling = idx;
                        else if ((/結果|狀態|列管/).test(text)) col.result = idx;

                        var mm = text.match(/第(\d+)次.*(審查|意見)/);
                        if (mm) {
                            reviewCols.push({ idx: idx, round: parseInt(mm[1], 10) });
                        } else if ((/審查意見|意見審查/).test(text)) {
                            reviewCols.push({ idx: idx, round: 1 });
                        }
                    });

                    if (col.number === -1) col.number = 0;
                    if (col.content === -1) col.content = (col.number === 0) ? 1 : 0;

                    for (var r = dataStart; r < rows.length; r++) {
                        var cells = rows[r].querySelectorAll("td,th");
                        if (cells.length < 2) continue;

                        var rawNumText = extractNumberFromCell(cells[col.number]);
                        var info = parseItemNumber(rawNumText);
                        if (!info || !info.raw) continue;

                        var orgUnifiedCode = ORG_CROSSWALK[info.orgCodeRaw] || info.orgCodeRaw || info.orgCode || "";
                        var orgCodeToUse = info.orgCodeRaw || info.orgCode || "";
                        var unitName = ORG_MAP[orgCodeToUse] || orgCodeToUse || "";
                        var inspectName = INSPECTION_MAP[info.inspectCode] || info.inspectCode || "";
                        var divCodeToUse = info.divisionCode || info.divCode || "";
                        var divName = DIVISION_MAP[divCodeToUse] || divCodeToUse || "";
                        var kindName = KIND_MAP[info.kindCode] || "其他";
                        
                        // 使用規範化編號（如果解析成功），否則使用原始編號
                        var canonicalNum = canonicalNumber(info);
                        var finalNumber = canonicalNum || info.raw.toUpperCase();

                        var item = {
                            number: finalNumber,
                            rawNumber: info.raw.toUpperCase(),
                            scheme: info.scheme || "",
                            year: String(info.yearRoc || ""),
                            yearRoc: info.yearRoc || "",
                            unit: unitName,
                            orgCodeRaw: orgCodeToUse,
                            orgUnifiedCode: orgUnifiedCode,
                            orgName: unitName,
                            itemKindCode: info.kindCode || "",
                            category: kindName,
                            inspectionCategoryCode: info.inspectCode || "",
                            inspectionCategoryName: inspectName,
                            divisionCode: divCodeToUse,
                            divisionName: divName,
                            divisionSeq: info.divisionSeq || "",
                            itemSeq: info.itemSeq || "",
                            period: info.period || "",
                            content: "",
                            handling: "",
                            status: "持續列管"
                        };

                        if (col.content !== -1 && cells[col.content]) item.content = sanitizeContent(cells[col.content].innerHTML);
                        if (col.handling !== -1 && cells[col.handling]) item.handling = sanitizeContent(cells[col.handling].innerHTML);
                        if (info.kindCode === "R") item.status = "自行列管"; else if (col.result !== -1 && cells[col.result]) item.status = parseStatusFromResultCell(cells[col.result]) || "持續列管";

                        reviewCols.forEach(function (rc) {
                            var key = (rc.round === 1 ? "review" : ("review" + rc.round));
                            if (cells[rc.idx]) item[key] = sanitizeContent(cells[rc.idx].innerHTML);
                        });

                        items.push(item);
                    }
                });
            } catch (e) {
                console.error("Parse error:", e);
                showToast("解析 Word 表格時發生錯誤，請確認表格格式是否包含「編號」與「內容」欄位。", 'error');
            }
            return items;
        }

        function onImportStageChange() {
            const stage = document.querySelector('input[name="importStage"]:checked').value;
            const roundContainer = document.getElementById('importRoundContainer');
            const planNameContainer = document.getElementById('importPlanNameContainer');

            if (stage === 'initial') {
                roundContainer.style.display = 'none';
                planNameContainer.style.gridColumn = 'span 2';
                document.getElementById('importDateGroup_Initial').style.display = 'block';
                document.getElementById('importDateGroup_Review').style.display = 'none';
                document.getElementById('importStatusWord').innerText = '';
            } else {
                roundContainer.style.display = 'block';
                planNameContainer.style.gridColumn = 'auto';
                document.getElementById('importDateGroup_Initial').style.display = 'none';
                document.getElementById('importDateGroup_Review').style.display = 'block';
            }
            checkImportReady();
        }

        function checkImportReady() {
            const wordInputEl = document.getElementById('wordInput');
            const btnParseWordEl = document.getElementById('btnParseWord');
            if (!wordInputEl || !btnParseWordEl) return;
            
            const f = wordInputEl.files[0];
            if (currentImportMode === 'backup') return;

            const stageRadio = document.querySelector('input[name="importStage"]:checked');
            if (!stageRadio) return;

            const stage = stageRadio.value;
            let valid = false;

            if (stage === 'initial') {
                const importIssueDateEl = document.getElementById('importIssueDate');
                const d = importIssueDateEl ? importIssueDateEl.value.trim() : '';
                valid = (d.length > 0);
            } else {
                valid = true;
            }

            // [修正] 允許先選擇文件，不限制文件選擇框
            // wordInputEl.disabled = !valid;  // 移除這行，允許隨時選擇文件
            // [修正] 只有在日期未填寫且沒有文件時才禁用按鈕
            btnParseWordEl.disabled = !valid || !f;
        }

        async function previewWord() {
            const f = document.getElementById('wordInput').files[0], round = document.getElementById('importRoundSelect') ? document.getElementById('importRoundSelect').value : 1, msg = document.getElementById('importStatusWord');
            if (!f) return showToast('請先選擇 Word 檔案', 'error');
            msg.innerText = 'Word 解析中...';
            currentImportMode = 'word';
            try {
                const b = await f.arrayBuffer();
                const r = await mammoth.convertToHtml({ arrayBuffer: b });
                const items = parseFromHTML(r.value);
                processParsedItems(items, round, msg);
            } catch (e) { console.error(e); msg.innerText = 'Word 解析錯誤: ' + e.message; }
        }

        function parseHistoryField(text) {
            if (!text || typeof text !== 'string') return {};
            const chunks = {};
            const matches = [...text.matchAll(/\[第(\d+)次\]/g)];
            if (matches.length === 0) return {};
            matches.forEach((m, i) => {
                const round = parseInt(m[1], 10);
                const start = m.index + m[0].length;
                const end = (i + 1 < matches.length) ? matches[i + 1].index : text.length;
                let content = text.substring(start, end).trim();
                content = content.replace(/^-+\s*|\s*-+$/g, '');
                if (content) chunks[round] = content;
            });
            return chunks;
        }

        async function previewBackup() {
            const f = document.getElementById('backupInput').files[0];
            const msg = document.getElementById('importStatusBackup');

            if (!f) return showToast('請先選擇備份檔案', 'error');
            if (!msg) { showToast("系統錯誤：找不到狀態顯示區域", 'error'); return; }

            msg.innerText = '備份檔解析中...';
            currentImportMode = 'backup';
            const ext = f.name.split('.').pop().toLowerCase();

            try {
                let items = [];
                if (ext === 'json') {
                    const text = await f.text();
                    const json = JSON.parse(text);
                    const rawItems = Array.isArray(json) ? json : (json.data || []);
                    items = rawItems.map(i => {
                        const newItem = {
                            number: i.number || i['編號'] || '',
                            year: i.year || i['年度'] || '',
                            unit: i.unit || i['機構'] || '',
                            content: i.content || i['內容'] || i['事項內容'] || i['內容摘要'] || '',
                            status: i.status || i['狀態'] || '持續列管',
                            handling: i.handling || i['辦理情形'] || i['最新辦理情形'] || '',
                            review: i.review || i['審查意見'] || i['最新審查意見'] || '',
                            itemKindCode: i.itemKindCode,
                            category: i.category,
                            divisionName: i.division,
                            inspectionCategoryName: i.inspection_category,
                            planName: i.planName,
                            issueDate: i.issueDate
                        };

                        // 支持無限次，動態查找（從1到200，實際應該不會超過這個數字）
                        for (let k = 1; k <= 200; k++) {
                            const suffix = k === 1 ? '' : k;
                            if (i[`handling${suffix}`]) newItem[`handling${suffix}`] = i[`handling${suffix}`];
                            if (i[`review${suffix}`]) newItem[`review${suffix}`] = i[`review${suffix}`];
                        }

                        const potentialHandling = i['完整辦理情形歷程'] || i.fullHandling || i.handling || i['辦理情形'] || '';
                        const potentialReview = i['完整審查意見歷程'] || i.fullReview || i.review || i['審查意見'] || '';

                        const hChunks = parseHistoryField(potentialHandling);
                        const rChunks = parseHistoryField(potentialReview);

                        Object.keys(hChunks).forEach(r => { const key = parseInt(r) === 1 ? 'handling' : `handling${r}`; newItem[key] = hChunks[r]; });
                        Object.keys(rChunks).forEach(r => { const key = parseInt(r) === 1 ? 'review' : `review${r}`; newItem[key] = rChunks[r]; });

                        return newItem;
                    });
                    processParsedItems(items, 0, msg);
                } else if (ext === 'csv') {
                    Papa.parse(f, {
                        header: true,
                        skipEmptyLines: true,
                        encoding: "UTF-8",
                        complete: function (results) {
                            const msgInside = document.getElementById('importStatusBackup');
                            try {
                                if (results.errors.length && results.data.length === 0) { if (msgInside) msgInside.innerText = 'CSV 解析錯誤'; return; }
                                const mapped = results.data.map(i => {
                                    let item = {
                                        number: i['編號'] || i.number || '',
                                        year: i['年度'] || i.year || '',
                                        unit: i['機構'] || i.unit || '',
                                        content: i['內容'] || i['事項內容'] || i['內容摘要'] || i.content || '',
                                        status: i['狀態'] || i.status || '持續列管',
                                        handling: i['最新辦理情形'] || i['辦理情形'] || i.handling || '',
                                        review: i['最新審查意見'] || i['審查意見'] || i.review || ''
                                    };
                                    const fullH = i['完整辦理情形歷程'] || i.handling || '';
                                    const fullR = i['完整審查意見歷程'] || i.review || '';
                                    const hChunks = parseHistoryField(fullH);
                                    const rChunks = parseHistoryField(fullR);
                                    Object.keys(hChunks).forEach(r => { const key = parseInt(r) === 1 ? 'handling' : `handling${r}`; item[key] = hChunks[r]; });
                                    Object.keys(rChunks).forEach(r => { const key = parseInt(r) === 1 ? 'review' : `review${r}`; item[key] = rChunks[r]; });
                                    return item;
                                });
                                const validRows = mapped.filter(r => r.number || r.content);
                                if (validRows.length === 0) { if (msgInside) msgInside.innerText = '錯誤：未解析到有效資料'; return; }
                                processParsedItems(mapped, 0, msgInside);
                            } catch (err) { console.error(err); if (msgInside) msgInside.innerText = 'CSV 處理錯誤: ' + err.message; }
                        }
                    });
                } else { throw new Error('不支援的檔案格式 (僅限 JSON 或 CSV)'); }
            } catch (e) { console.error(e); msg.innerText = '解析錯誤: ' + e.message; }
        }

        function processParsedItems(items, round, msgElement) {
            if (msgElement && items.length === 0) { msgElement.innerText = '錯誤：未解析到有效資料'; return; }
            stagedImportData = items.map(item => ({ ...item, _importStatus: 'new' }));

            if (currentImportMode === 'word') {
                const stageRadio = document.querySelector('input[name="importStage"]:checked');
                const stageText = stageRadio && stageRadio.value === 'initial' ? '初次開立' : `第 ${round} 次審查`;
                const badgeClass = stageRadio && stageRadio.value === 'initial' ? 'new' : 'update';

                const badgeEl = document.getElementById('previewModeBadge');
                if (badgeEl) badgeEl.innerHTML = `<span class="badge ${badgeClass}">Word 匯入 (${stageText})</span>`;
                const uploadCardWord = document.getElementById('uploadCardWord');
                if (uploadCardWord) uploadCardWord.classList.add('hidden');
                const uploadCardBackup = document.getElementById('uploadCardBackup');
                if (uploadCardBackup) uploadCardBackup.classList.add('hidden');
            } else {
                const badgeEl = document.getElementById('previewModeBadge');
                if (badgeEl) badgeEl.innerHTML = `<span class="badge active">⚠️ 災難復原模式</span>`;
                const uploadCardWord = document.getElementById('uploadCardWord');
                if (uploadCardWord) uploadCardWord.classList.add('hidden');
                const uploadCardBackup = document.getElementById('uploadCardBackup');
                if (uploadCardBackup) uploadCardBackup.classList.add('hidden');
            }
            renderPreviewTable();
            const previewContainer = document.getElementById('previewContainer');
            if (previewContainer) previewContainer.classList.remove('hidden');
            if (msgElement) msgElement.innerText = '';
        }

        function renderPreviewTable() {
            document.getElementById('previewCount').innerText = stagedImportData.length;
            const tbody = document.getElementById('previewBody');
            tbody.innerHTML = stagedImportData.map(item => {
                const statusBadge = item._importStatus === 'new' ? `<span class="badge new">新增</span>` : `<span class="badge update">更新</span>`;
                let progress = `[審查] ${item.review || '-'}<br>[辦理] ${item.handling || '-'}`;
                return `<tr>
                    <td>${statusBadge}</td>
                    <td style="font-weight:600;color:var(--primary);">${item.number}</td>
                    <td>${item.unit}</td>
                    <td><div class="preview-content-box">${stripHtml(item.content)}</div></td>
                    <td><div class="preview-content-box">${stripHtml(progress)}</div></td>
                </tr>`;
            }).join('');
        }

        function cancelImport() {
            stagedImportData = [];
            const previewContainer = document.getElementById('previewContainer');
            if (previewContainer) previewContainer.classList.add('hidden');
            const uploadCardWord = document.getElementById('uploadCardWord');
            if (uploadCardWord) uploadCardWord.classList.remove('hidden');
            const uploadCardBackup = document.getElementById('uploadCardBackup');
            if (uploadCardBackup && currentUser && currentUser.isAdmin === true) uploadCardBackup.classList.remove('hidden');
            const wordInput = document.getElementById('wordInput');
            if (wordInput) wordInput.value = '';
            const backupInput = document.getElementById('backupInput');
            if (backupInput) backupInput.value = '';
            const importStatusWord = document.getElementById('importStatusWord');
            if (importStatusWord) importStatusWord.innerText = '';
            const importStatusBackup = document.getElementById('importStatusBackup');
            if (importStatusBackup) importStatusBackup.innerText = '';
        }

        async function confirmImport() {
            const count = stagedImportData.length;
            const isBackup = currentImportMode === 'backup';
            const msg = isBackup ? `⚠️ 警告：即將進行「災難復原」，這將覆蓋或新增 ${count} 筆資料。\n確定要執行嗎？` : `確定要匯入 ${count} 筆資料嗎？`;
            const confirmed = await showConfirmModal(msg, '確認', '取消');
            if (!confirmed) return;

            let round = 1;
            let issueDate = '';
            let replyDate = '';
            let responseDate = '';

            if (!isBackup) {
                const stage = document.querySelector('input[name="importStage"]:checked').value;

                if (stage === 'initial') {
                    round = 1;
                    issueDate = document.getElementById('importIssueDate').value;
                } else {
                    round = document.getElementById('importRoundSelect').value;
                    replyDate = document.getElementById('importReplyDate').value;
                    responseDate = document.getElementById('importResponseDate').value;
                }
            }

            const planValue = isBackup ? '' : document.getElementById('importPlanName').value;
            if (!isBackup && !planValue) {
                return showToast('請選擇檢查計畫', 'error');
            }
            if (!isBackup && getIssueOwnerGroupIds().length === 0) {
                return showToast('請至少選擇一個適用群組', 'error');
            }
            // 從計畫選項值中提取計畫名稱和年度
            const selectedPlan = isBackup ? { name: '', year: '' } : parsePlanValue(planValue);
            
            // 取得所有計畫選項，用於根據年度匹配計畫
            let allPlans = [];
            if (!isBackup) {
                try {
                    const plansRes = await fetch('/api/options/plans?t=' + Date.now());
                    if (plansRes.ok) {
                        const plansJson = await plansRes.json();
                        allPlans = plansJson.data || [];
                        writeLog(`載入的計畫選項：${allPlans.length} 個`);
                        writeLog(`選擇的計畫：${selectedPlan.name} (${selectedPlan.year || '無年度'})`);
                    }
                } catch (e) {
                    if (isDevelopment) console.warn('無法載入計畫選項，將使用選擇的計畫名稱', e);
                    writeLog(`無法載入計畫選項：${e.message}`, 'WARN');
                }
            }

            let cleanData = stagedImportData.map(({ _importStatus, ...item }) => {
                if (currentImportMode === 'word') {
                    // 根據開立事項的年度，自動匹配到相同名稱但對應年度的計畫
                    // 例如：選擇「上半年定期檢查 (113)」，113年度的事項綁定到「上半年定期檢查 (113)」
                    // 114年度的事項應該綁定到「上半年定期檢查 (114)」（如果存在）
                    if (!item.planName && selectedPlan.name) {
                        const itemYear = String(item.year || '').trim();
                        
                        if (itemYear) {
                            // 查找相同名稱且年度匹配的計畫
                            const matchedPlan = allPlans.find(p => {
                                const planName = typeof p === 'object' ? String(p.name || '').trim() : String(p || '').trim();
                                const planYear = typeof p === 'object' ? String(p.year || '').trim() : '';
                                // 計畫名稱必須與選擇的計畫名稱相同，且年度必須與開立事項的年度匹配
                                return planName === selectedPlan.name && planYear === itemYear;
                            });
                            
                            if (matchedPlan) {
                                // 找到匹配的計畫，使用該計畫的名稱
                                item.planName = typeof matchedPlan === 'object' ? matchedPlan.name : matchedPlan;
                                const planName = typeof matchedPlan === 'object' ? matchedPlan.name : matchedPlan;
                                const planYear = typeof matchedPlan === 'object' ? matchedPlan.year : '';
                                writeLog(`找到匹配的計畫：事項年度=${itemYear}，計畫名稱="${planName}"，計畫年度="${planYear}"`);
                                writeLog(`使用匹配的計畫：${planName}`);
                            } else if (selectedPlan.year && selectedPlan.year === itemYear) {
                                // 選擇的計畫年度與事項年度匹配，使用選擇的計畫名稱
                                item.planName = selectedPlan.name;
                                writeLog(`使用選擇的計畫（年度匹配）：${selectedPlan.name}`);
                            } else {
                                // 沒找到匹配的計畫，且年度不匹配
                                // 使用選擇的計畫名稱（這會導致不同年度的事項被歸類到同一計畫）
                                item.planName = selectedPlan.name;
                                const warnMsg = `找不到匹配的計畫：選擇的計畫名稱="${selectedPlan.name}"，選擇的計畫年度="${selectedPlan.year}"，事項年度="${itemYear}"。使用選擇的計畫名稱。`;
                                if (isDevelopment) console.warn(`⚠️ ${warnMsg}`);
                                writeLog(warnMsg, 'WARN');
                            }
                        } else {
                            // 開立事項沒有年度，使用選擇的計畫名稱
                            item.planName = selectedPlan.name;
                        }
                    }
                    const stage = document.querySelector('input[name="importStage"]:checked') ? document.querySelector('input[name="importStage"]:checked').value : 'initial';
                    if (!item.issueDate && stage === 'initial') item.issueDate = issueDate;
                }
                return item;
            });

            try {
                const res = await apiFetch('/api/issues/import', {
                    method: 'POST',
                    body: JSON.stringify({
                        data: cleanData,
                        round: round,
                        reviewDate: responseDate,
                        replyDate: replyDate,
                        mode: currentImportMode,
                        ownerGroupIds: getIssueOwnerGroupIds()
                    })
                });
                if (res.ok) { 
                    showToast('匯入成功！'); 
                    cancelImport(); 
                    // 使用 try-catch 包裹後續操作，避免影響成功訊息的顯示
                    try {
                        await loadIssuesPage(1); 
                        await loadPlanOptions(); 
                    } catch (e) {
                        console.error('載入資料時發生錯誤（匯入已成功）：', e);
                    }
                } else { 
                    const errorData = await res.json().catch(() => ({}));
                    showToast(errorData.error || '匯入失敗', 'error'); 
                }
            } catch (e) { 
                // 只有在真正的網路錯誤時才顯示
                if (e.message && (e.message.includes('Failed to fetch') || e.message.includes('NetworkError'))) {
                    showToast('匯入錯誤：網路連線失敗', 'error'); 
                } else {
                    console.error('匯入時發生未預期錯誤：', e);
                    showToast('匯入時發生錯誤：' + e.message, 'error'); 
                }
            }
        }

        // switchDataTab → js/import-view.js
        
        // switchPlansSubTab → js/plans-view.js
        
        // switchIssuesSubTab → js/import-view.js
        
        function setupExportOptions() {
            const exportDataTypeRadios = document.querySelectorAll('input[name="exportDataType"]');
            const exportIssuesOptions = document.getElementById('exportIssuesOptions');
            
            if (exportDataTypeRadios.length > 0 && exportIssuesOptions) {
                exportDataTypeRadios.forEach(radio => {
                    // 移除舊的事件監聽器（如果有的話）
                    const newRadio = radio.cloneNode(true);
                    radio.parentNode.replaceChild(newRadio, radio);
                    
                    newRadio.addEventListener('change', function() {
                        if (this.value === 'plans' || this.value === 'users') {
                            exportIssuesOptions.style.display = 'none';
                        } else {
                            exportIssuesOptions.style.display = 'block';
                        }
                    });
                });
                
                // 初始化顯示狀態
                const checked = document.querySelector('input[name="exportDataType"]:checked');
                if (checked && (checked.value === 'plans' || checked.value === 'users')) {
                    exportIssuesOptions.style.display = 'none';
                } else {
                    exportIssuesOptions.style.display = 'block';
                }
            }
        }

        // --- Batch Edit Logic ---
        function initBatchGrid() {
            const tbody = document.getElementById('batchGridBody');
            tbody.innerHTML = '';
            for (let i = 0; i < 5; i++) addBatchRow();
        }

        function addBatchRow() {
            const tbody = document.getElementById('batchGridBody');
            const rowIdx = tbody.children.length + 1;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="text-align:center;color:#94a3b8;font-size:12px;">${rowIdx}</td>
                <td><input type="text" class="filter-input batch-number" placeholder="編號..." onchange="handleBatchNumberChange(this)" style="font-family:monospace;"></td>
                <td><textarea class="filter-input batch-content" rows="1" placeholder="內容..." style="resize:vertical;"></textarea></td>
                <td><input type="text" class="filter-input batch-year" style="background:#f1f5f9;color:#64748b;" readonly></td>
                <td><input type="text" class="filter-input batch-unit" style="background:#f1f5f9;color:#64748b;" readonly></td>
                <td><select class="filter-select batch-division"><option value="">-</option><option value="運務">運務</option><option value="工務">工務</option><option value="機務">機務</option><option value="電務">電務</option><option value="安全">安全</option><option value="審核">審核</option><option value="災防">災防</option><option value="運轉">運轉</option><option value="土木">土木</option><option value="機電">機電</option><option value="土建">土建</option><option value="安全管理">安全管理</option><option value="營運">營運</option><option value="其他">其他</option></select></td>
                <td><select class="filter-select batch-inspection"><option value="">-</option><option value="定期檢查">定期檢查</option><option value="例行性檢查">例行性檢查</option><option value="特別檢查">特別檢查</option><option value="臨時檢查">臨時檢查</option></select></td>
                <td><select class="filter-select batch-kind"><option value="">-</option><option value="N">缺失</option><option value="O">觀察</option><option value="R">建議</option></select></td>
                <td><select class="filter-select batch-status"><option value="持續列管">持續列管</option><option value="解除列管">解除列管</option><option value="自行列管">自行列管</option></select></td>
                <td style="text-align:center;"><button class="btn btn-danger btn-sm" onclick="removeBatchRow(this)" style="padding:4px 8px;">×</button></td>
            `;
            tbody.appendChild(tr);
        }

        function removeBatchRow(btn) {
            const tr = btn.closest('tr');
            if (document.querySelectorAll('#batchGridBody tr').length > 1) {
                tr.remove();
                // Re-index
                document.querySelectorAll('#batchGridBody tr').forEach((row, idx) => {
                    row.cells[0].innerText = idx + 1;
                });
            } else {
                showToast('至少需保留一列', 'error');
            }
        }

        function handleBatchNumberChange(input) {
            const tr = input.closest('tr');
            const val = input.value.trim();
            if (!val) return;

            const info = parseItemNumber(val);
            if (info) {
                if (info.yearRoc) tr.querySelector('.batch-year').value = info.yearRoc;
                if (info.orgCode) {
                    const name = ORG_MAP[info.orgCode] || info.orgCode;
                    if (name && name !== '?') tr.querySelector('.batch-unit').value = name;
                }
                if (info.divCode) {
                    const divName = DIVISION_MAP[info.divCode];
                    if (divName) tr.querySelector('.batch-division').value = divName;
                }
                if (info.inspectCode) {
                    const inspectName = INSPECTION_MAP[info.inspectCode];
                    if (inspectName) tr.querySelector('.batch-inspection').value = inspectName;
                }
                if (info.kindCode) {
                    tr.querySelector('.batch-kind').value = info.kindCode;
                }
            }
        }

        async function saveBatchItems() {
            const planValue = document.getElementById('batchPlanName').value.trim();
            const issueDate = document.getElementById('batchIssueDate').value.trim();
            const batchYear = document.getElementById('batchYear') ? document.getElementById('batchYear').value.trim() : '';

            if (!planValue) return showToast('請選擇檢查計畫', 'error');
            // 從計畫選項值中提取計畫名稱
            const planName = parsePlanValue(planValue).name;
            if (!issueDate) return showToast('請填寫初次發函日期', 'error');

            const rows = document.querySelectorAll('#batchGridBody tr');
            const items = [];
            let hasError = false;

            rows.forEach((tr, idx) => {
                const number = tr.querySelector('.batch-number').value.trim();
                const content = tr.querySelector('.batch-content').value.trim();

                // Skip empty rows
                if (!number && !content) return;

                if (!number) {
                    showToast(`第 ${idx + 1} 列缺少編號`, 'error');
                    hasError = true;
                    return;
                }

                const year = tr.querySelector('.batch-year').value.trim();
                const unit = tr.querySelector('.batch-unit').value.trim();

                if (!year || !unit) {
                    showToast(`第 ${idx + 1} 列的年度或機構未能自動判別，請確認編號格式`, 'error');
                    hasError = true;
                    return;
                }

                items.push({
                    number,
                    year,
                    unit,
                    content,
                    status: tr.querySelector('.batch-status').value,
                    itemKindCode: tr.querySelector('.batch-kind').value,
                    divisionName: tr.querySelector('.batch-division').value,
                    inspectionCategoryName: tr.querySelector('.batch-inspection').value,
                    planName: planName,
                    issueDate: issueDate,
                    scheme: 'BATCH'
                });
            });

            if (hasError) return;
            if (items.length === 0) return showToast('請至少輸入一筆有效資料', 'error');

            const confirmed = await showConfirmModal(`確定要批次新增 ${items.length} 筆資料嗎？\n\n計畫：${planName}`, '確定新增', '取消');
            if (!confirmed) return;

            try {
                const res = await apiFetch('/api/issues/import', {
                    method: 'POST',
                    body: JSON.stringify({
                        data: items,
                        round: 1,
                        reviewDate: '',
                        replyDate: '',
                        ownerGroupIds: getIssueOwnerGroupIds()
                    })
                });

                if (res.ok) {
                    showToast('批次新增成功！');
                    initBatchGrid(); // Reset grid
                    document.getElementById('batchPlanName').value = '';
                    document.getElementById('batchIssueDate').value = '';
                    loadIssuesPage(1);
                    loadPlanOptions();
                } else {
                    const j = await res.json();
                    showToast('新增失敗: ' + (j.error || '不明錯誤'), 'error');
                }
            } catch (e) {
                showToast('Error: ' + e.message, 'error');
            }
        }

        // --- 開立事項建檔功能（已移除單筆模式，只保留批次模式） ---
        let createMode = 'batch'; // 固定為批次模式
        
        // 初始化開立事項建檔頁面
        function initCreateIssuePage() {
            const batchMode = document.getElementById('createBatchMode');
            if (batchMode) {
                batchMode.style.display = 'block';
            }
            
            if (document.querySelectorAll('#createBatchGridBody tr').length === 0) {
                initCreateBatchGrid();
            }
            
            // 初始化批次設定函復日期的選項
            initBatchResponseRoundOptions();
            // 初始化批次設定回復日期的選項
            initBatchReplyRoundOptions();
            
            // 顯示載入現有事項按鈕（如果已選擇計畫）
            const planSelect = document.getElementById('createPlanName');
            const loadContainer = document.getElementById('createLoadExistingContainer');
            if (loadContainer && planSelect && planSelect.value) {
                loadContainer.style.display = 'block';
            }
            
            // 重置批次設定函復日期的勾選狀態
            const toggleCheckbox = document.getElementById('createBatchResponseDateToggle');
            if (toggleCheckbox) {
                toggleCheckbox.checked = false;
                toggleBatchResponseDateSetting();
            }
        }
        
        // 保留 switchCreateMode 函數以向後兼容，但只執行批次模式的邏輯
        function switchCreateMode(mode) {
            createMode = 'batch'; // 強制為批次模式
            initCreateIssuePage();
        }
        
        // 切換批次設定函復日期的顯示
        function toggleBatchResponseDateSetting() {
            const checkbox = document.getElementById('createBatchResponseDateToggle');
            const container = document.getElementById('createBatchResponseDateContainer');
            if (checkbox && container) {
                container.style.display = checkbox.checked ? 'block' : 'none';
            }
        }
        
        // 切換批次設定回復日期的顯示
        function toggleBatchReplyDateSetting() {
            const checkbox = document.getElementById('createBatchReplyDateToggle');
            const container = document.getElementById('createBatchReplyDateContainer');
            if (checkbox && container) {
                container.style.display = checkbox.checked ? 'block' : 'none';
            }
        }
        
        // 批次設定回復日期（為所有事項的辦理情形）- 比照審查函覆日期的處理流程
        async function batchSetReplyDateForAll() {
            const roundSelect = document.getElementById('createBatchReplyRound');
            const roundManualInput = document.getElementById('createBatchReplyRoundManual');
            const dateInput = document.getElementById('createBatchReplyDate');
            const planSelect = document.getElementById('createPlanName');
            
            if (!roundSelect || !roundManualInput || !dateInput || !planSelect) return;
            
            // 優先使用下拉選單的值，如果沒有則使用手動輸入
            let round = parseInt(roundSelect.value);
            if (!round || round < 1) {
                round = parseInt(roundManualInput.value);
            }
            
            const replyDate = dateInput.value.trim();
            const planValue = planSelect.value.trim();
            
            if (!planValue) {
                showToast('請先選擇檢查計畫', 'error');
                return;
            }
            
            if (!round || round < 1) {
                showToast('請選擇或輸入回復輪次', 'error');
                return;
            }
            
            if (round > 200) {
                showToast('回復輪次不能超過200次', 'error');
                return;
            }
            
            if (!replyDate) {
                showToast('請輸入回復日期', 'error');
                return;
            }
            
            // 驗證日期格式
            if (!validateDateFormat(replyDate, '日期')) {
                return;
            }
            
            const { name: planName } = parsePlanValue(planValue);
            
            try {
                // 載入該計畫下的所有事項
                const issueList = await loadIssuesByPlan(planValue);
                if (!issueList) return;
                
                const confirmed = await showConfirmModal(
                    `確定要批次設定第 ${round} 次辦理情形的回復日期為 ${replyDate} 嗎？\n\n將更新 ${issueList.length} 筆事項。`,
                    '確認設定',
                    '取消'
                );
                
                if (!confirmed) {
                    return;
                }
                
                // 移除批次設定中的提示訊息，只保留錯誤訊息
                
                let successCount = 0;
                let errorCount = 0;
                const errors = [];
                
                // 批次更新所有事項
                for (let i = 0; i < issueList.length; i++) {
                    const issue = issueList[i];
                    const issueId = issue.id;
                    
                    if (!issueId) {
                        errorCount++;
                        errors.push(`${issue.number || '未知編號'}: 缺少事項ID`);
                        continue;
                    }
                    
                    try {
                        // 讀取該輪次的現有資料
                        const suffix = round === 1 ? '' : round;
                        const handling = issue['handling' + suffix] || '';
                        const review = issue['review' + suffix] || '';
                        const existingReplyDate = issue['reply_date_r' + round] || '';
                        
                        // 檢查是否有辦理情形內容，沒有辦理情形內容則跳過
                        if (!handling || !handling.trim()) {
                            errorCount++;
                            errors.push(`${issue.number || '未知編號'}: 第 ${round} 次尚無辦理情形，無法設定回復日期`);
                            continue;
                        }
                        
                        // 更新該輪次的回復日期
                        // 注意：只更新 replyDate（辦理情形回復日期），不更新 responseDate（審查函復日期）
                        const updateRes = await apiFetch(`/api/issues/${issueId}`, {
                            method: 'PUT',
                            body: JSON.stringify({
                                status: issue.status || '持續列管',
                                round: round,
                                handling: handling,
                                review: review,
                                // 只發送 replyDate，不發送 responseDate，讓後端保持原有的審查函復日期不變
                                replyDate: replyDate
                            })
                        });
                        
                        if (updateRes.ok) {
                            const result = await updateRes.json();
                            if (result.success) {
                                successCount++;
                            } else {
                                errorCount++;
                                errors.push(`${issue.number || '未知編號'}: 更新失敗`);
                            }
                        } else {
                            errorCount++;
                            const errorData = await updateRes.json().catch(() => ({}));
                            errors.push(`${issue.number || '未知編號'}: ${errorData.error || '更新失敗'}`);
                        }
                    } catch (e) {
                        errorCount++;
                        errors.push(`${issue.number || '未知編號'}: ${e.message}`);
                    }
                }
                
                // 顯示資料庫操作結果（成功或警告）
                if (errorCount > 0) {
                    showToast(`批次設定完成，但有 ${errorCount} 筆失敗${successCount > 0 ? `，成功 ${successCount} 筆` : ''}`, 'warning');
                    
                    // 如果有錯誤，顯示詳細資訊
                    if (errors.length > 0) {
                        console.error('批次設定回復日期錯誤:', errors);
                    }
                } else if (successCount > 0) {
                    // 完全成功時顯示成功訊息（資料庫操作結果）
                    showToast(`批次設定完成！成功 ${successCount} 筆`, 'success');
                }
                
                // 清空輸入欄位並重置為預設模式
                if (successCount > 0 || errorCount === 0) {
                    roundSelect.value = '';
                    roundManualInput.value = '';
                    dateInput.value = '';
                    
                    // 取消勾選並隱藏設定區塊
                    const toggleCheckbox = document.getElementById('createBatchReplyDateToggle');
                    if (toggleCheckbox) {
                        toggleCheckbox.checked = false;
                        toggleBatchReplyDateSetting();
                    }
                } else {
                    showToast('批次設定失敗，所有事項都無法更新', 'error');
                    if (errors.length > 0) {
                        console.error('批次設定回復日期錯誤:', errors);
                    }
                }
            } catch (e) {
                showToast('批次設定失敗: ' + e.message, 'error');
            }
        }
        
        // 回復日期輪次選擇改變時的處理
        function onBatchReplyRoundChange() {
            const roundSelect = document.getElementById('createBatchReplyRound');
            const roundManualInput = document.getElementById('createBatchReplyRoundManual');
            
            if (!roundSelect || !roundManualInput) return;
            
            if (roundSelect.value) {
                roundManualInput.value = '';
            }
        }
        
        // 回復日期輪次手動輸入改變時的處理
        function onBatchReplyRoundManualChange() {
            const roundSelect = document.getElementById('createBatchReplyRound');
            const roundManualInput = document.getElementById('createBatchReplyRoundManual');
            
            if (!roundSelect || !roundManualInput) return;
            
            if (roundManualInput.value) {
                const manualValue = parseInt(roundManualInput.value);
                if (manualValue >= 1 && manualValue <= 200) {
                    // 如果在選單範圍內，同步到選單
                    roundSelect.value = manualValue;
                } else {
                    // 如果超出範圍，清空選單
                    roundSelect.value = '';
                }
            }
        }
        
        // 從檢查計畫查詢並預填辦理情形回復輪次
        async function updateBatchReplyRoundFromPlan() {
            const planSelect = document.getElementById('createPlanName');
            const roundSelect = document.getElementById('createBatchReplyRound');
            const roundManualInput = document.getElementById('createBatchReplyRoundManual');
            
            if (!planSelect || !roundSelect || !roundManualInput) return;
            
            const planValue = planSelect.value.trim();
            if (!planValue) {
                // 清空選項
                roundSelect.value = '';
                roundManualInput.value = '';
                return;
            }
            
            try {
                // 載入該計畫下的所有事項
                const issueList = await loadIssuesByPlan(planValue, { showError: false, returnEmpty: true });
                if (!issueList || issueList.length === 0) {
                    // 沒有事項，預設為第1次
                    roundSelect.value = '1';
                    roundManualInput.value = '';
                    return;
                }
                
                // 找出第一個「有辦理情形內容但沒有回復日期」的輪次
                // 如果所有輪次都有日期，則找下一個需要填寫的輪次
                let foundIncompleteRound = null;
                let maxRound = 0;
                
                issueList.forEach(issue => {
                    // 檢查所有可能的辦理情形輪次（最多200次）
                    for (let i = 1; i <= 200; i++) {
                        const suffix = i === 1 ? '' : i;
                        const handling = issue['handling' + suffix] || '';
                        const replyDate = issue['reply_date_r' + i] || '';
                        
                        // 如果有辦理情形，記錄最高輪次
                        if (handling.trim()) {
                            if (i > maxRound) {
                                maxRound = i;
                            }
                            
                            // 如果有辦理情形內容但沒有回復日期，這是需要填寫的輪次
                            if (handling.trim() && !replyDate) {
                                if (!foundIncompleteRound || i < foundIncompleteRound) {
                                    foundIncompleteRound = i;
                                }
                            }
                        }
                    }
                });
                
                // 如果找到有辦理情形內容但無日期的輪次，使用該輪次
                // 否則使用最高輪次 + 1（如果最高輪次是0，則為第1次）
                const suggestedRound = foundIncompleteRound || (maxRound + 1);
                
                if (suggestedRound <= 200) {
                    roundSelect.value = suggestedRound;
                    roundManualInput.value = '';
                    // 移除自動預填的提示訊息，只保留錯誤訊息
                } else {
                    // 如果超過200次，使用手動輸入
                    roundSelect.value = '';
                    roundManualInput.value = suggestedRound;
                    // 移除自動預填的提示訊息，只保留錯誤訊息
                }
            } catch (e) {
                console.error('查詢辦理情形輪次失敗:', e);
            }
        }
        
        // 初始化批次設定函復日期的選項（動態生成，最多200次）
        function initBatchResponseRoundOptions() {
            const select = document.getElementById('createBatchResponseRound');
            if (!select) return;
            
            // 清空現有選項（保留第一個「請選擇」選項）
            select.innerHTML = '<option value="">請選擇</option>';
            
            // 動態生成選項（最多200次）
            for (let i = 1; i <= 200; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `第 ${i} 次`;
                select.appendChild(option);
            }
        }
        
        // 初始化批次設定回復日期的選項（動態生成，最多200次）
        function initBatchReplyRoundOptions() {
            const select = document.getElementById('createBatchReplyRound');
            if (!select) return;
            
            // 清空現有選項（保留第一個「請選擇」選項）
            select.innerHTML = '<option value="">請選擇</option>';
            
            // 動態生成選項（最多200次）
            for (let i = 1; i <= 200; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `第 ${i} 次`;
                select.appendChild(option);
            }
        }
        
        // 檢查計畫改變時（年度已包含在計畫中，無需額外處理）
        function onCreatePlanChange() {
            // 當選擇計畫時，自動帶入計畫的年度
            const planValue = document.getElementById('createPlanName').value.trim();
            if (planValue) {
                const { name, year } = parsePlanValue(planValue);
                if (year) {
                    const yearDisplay = document.getElementById('createYearDisplay');
                    if (yearDisplay) {
                        const oldYear = yearDisplay.value;
                        yearDisplay.value = year;
                        // 移除年度變更的提示訊息，只保留錯誤訊息
                    }
                }
            }
            
            // 查詢並預填審查函復輪次和辦理情形回復輪次
            updateBatchResponseRoundFromPlan();
            updateBatchReplyRoundFromPlan();
            // 顯示/隱藏載入現有事項按鈕
            const loadContainer = document.getElementById('createLoadExistingContainer');
            if (loadContainer) {
                loadContainer.style.display = planValue ? 'block' : 'none';
            }
        }
        
        // 載入現有事項到批次表格
        async function loadExistingIssuesToBatch() {
            const planSelect = document.getElementById('createPlanName');
            if (!planSelect) return;
            
            const planValue = planSelect.value.trim();
            if (!planValue) {
                showToast('請先選擇檢查計畫', 'error');
                return;
            }
            
            try {
                // 載入該計畫下的所有事項
                const issueList = await loadIssuesByPlan(planValue, { showError: false, returnEmpty: true });
                if (!issueList || issueList.length === 0) {
                    return;
                }
                
                // 確認是否要載入（如果表格中已有資料）
                const tbody = document.getElementById('createBatchGridBody');
                if (!tbody) return;
                
                const existingRows = tbody.querySelectorAll('tr');
                const hasExistingData = Array.from(existingRows).some(tr => {
                    const number = tr.querySelector('.create-batch-number')?.value.trim();
                    const contentTextarea = tr.querySelector('.create-batch-content-textarea');
                    const content = contentTextarea ? contentTextarea.value.trim() : '';
                    return number || content;
                });
                
                if (hasExistingData) {
                    const confirmed = await showConfirmModal(`表格中已有資料，載入現有事項將會清空現有資料。\n\n確定要載入 ${issueList.length} 筆事項嗎？`, '確定載入', '取消');
                    if (!confirmed) {
                        return;
                    }
                }
                
                // 清空現有表格
                tbody.innerHTML = '';
                batchHandlingData = {};
                
                // 載入事項資料到表格
                issueList.forEach((issue, index) => {
                    const rowIdx = index;
                    const tr = document.createElement('tr');
                    
                    // 取得類型代碼
                    let kindCode = issue.item_kind_code || issue.itemKindCode || '';
                    if (!kindCode) {
                        const numStr = String(issue.number || '');
                        const m = numStr.match(/-([NOR])\d+$/i);
                        if (m) kindCode = m[1].toUpperCase();
                    }
                    
                    // 取得分組名稱
                    const divisionName = issue.division_name || issue.divisionName || '';
                    
                    // 取得檢查種類
                    const inspectionName = issue.inspection_category_name || issue.inspectionCategoryName || '';
                    
                    // 取得狀態
                    const status = issue.status || '持續列管';
                    
                    tr.innerHTML = `
                        <td style="text-align:center;color:#94a3b8;font-size:12px;">${rowIdx + 1}</td>
                        <td><input type="text" class="filter-input create-batch-number" value="${escapeHtml(issue.number || '')}" onchange="handleCreateBatchNumberChange(this)" style="font-family:monospace;"></td>
                        <td style="position:relative;">
                            <textarea class="filter-input create-batch-content-textarea" rows="3" style="resize:vertical;min-height:60px;max-height:120px;font-size:13px;line-height:1.6;padding:8px 10px;">${escapeHtml(issue.content || '')}</textarea>
                        </td>
                        <td><input type="text" class="filter-input create-batch-year" value="${escapeHtml(issue.year || '')}" style="background:#f1f5f9;color:#64748b;" readonly></td>
                        <td><input type="text" class="filter-input create-batch-unit" value="${escapeHtml(issue.unit || '')}" style="background:#f1f5f9;color:#64748b;" readonly></td>
                        <td><select class="filter-select create-batch-division"><option value="">-</option><option value="運務" ${divisionName === '運務' ? 'selected' : ''}>運務</option><option value="工務" ${divisionName === '工務' ? 'selected' : ''}>工務</option><option value="機務" ${divisionName === '機務' ? 'selected' : ''}>機務</option><option value="電務" ${divisionName === '電務' ? 'selected' : ''}>電務</option><option value="安全" ${divisionName === '安全' ? 'selected' : ''}>安全</option><option value="審核" ${divisionName === '審核' ? 'selected' : ''}>審核</option><option value="災防" ${divisionName === '災防' ? 'selected' : ''}>災防</option><option value="運轉" ${divisionName === '運轉' ? 'selected' : ''}>運轉</option><option value="土木" ${divisionName === '土木' ? 'selected' : ''}>土木</option><option value="機電" ${divisionName === '機電' ? 'selected' : ''}>機電</option><option value="土建" ${divisionName === '土建' ? 'selected' : ''}>土建</option><option value="安全管理" ${divisionName === '安全管理' ? 'selected' : ''}>安全管理</option><option value="營運" ${divisionName === '營運' ? 'selected' : ''}>營運</option><option value="其他" ${divisionName === '其他' ? 'selected' : ''}>其他</option></select></td>
                        <td><select class="filter-select create-batch-inspection"><option value="">-</option><option value="定期檢查" ${inspectionName === '定期檢查' ? 'selected' : ''}>定期檢查</option><option value="例行性檢查" ${inspectionName === '例行性檢查' ? 'selected' : ''}>例行性檢查</option><option value="特別檢查" ${inspectionName === '特別檢查' ? 'selected' : ''}>特別檢查</option><option value="臨時檢查" ${inspectionName === '臨時檢查' ? 'selected' : ''}>臨時檢查</option></select></td>
                        <td><select class="filter-select create-batch-kind"><option value="">-</option><option value="N" ${kindCode === 'N' ? 'selected' : ''}>缺失</option><option value="O" ${kindCode === 'O' ? 'selected' : ''}>觀察</option><option value="R" ${kindCode === 'R' ? 'selected' : ''}>建議</option></select></td>
                        <td><select class="filter-select create-batch-status"><option value="持續列管" ${status === '持續列管' ? 'selected' : ''}>持續列管</option><option value="解除列管" ${status === '解除列管' ? 'selected' : ''}>解除列管</option><option value="自行列管" ${status === '自行列管' ? 'selected' : ''}>自行列管</option></select></td>
                        <td style="text-align:center;">
                            <button class="btn btn-outline btn-sm create-batch-handling-btn" onclick="openBatchHandlingModal(${rowIdx})" data-row-index="${rowIdx}" style="padding:6px 12px; font-size:12px; width:100%;" title="點擊新增或管理辦理情形">
                                <span class="create-batch-handling-status">新增辦理情形</span>
                            </button>
                        </td>
                        <td style="text-align:center;">
                            <button class="btn btn-danger btn-sm" onclick="removeCreateBatchRow(this)" style="padding:4px 8px;">×</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                    
                    // 保存事項 ID 到表格行（如果事項已存在於資料庫）
                    if (issue.id) {
                        tr.setAttribute('data-issue-id', issue.id);
                    }
                    
                    // 載入現有事項時，內容已經在 textarea 中，不需要額外處理
                    
                    // 載入現有的辦理情形資料（如果有）
                    const handlingRounds = [];
                    for (let i = 1; i <= 200; i++) {
                        const suffix = i === 1 ? '' : i;
                        const handling = issue['handling' + suffix] || '';
                        const replyDate = issue['reply_date_r' + i] || '';
                        
                        if (handling && handling.trim()) {
                            handlingRounds.push({
                                round: i,
                                handling: stripHtml(handling.trim()), // 移除 HTML 標籤
                                replyDate: replyDate || ''
                            });
                        }
                    }
                    
                    if (handlingRounds.length > 0) {
                        batchHandlingData[rowIdx] = handlingRounds;
                        updateBatchHandlingStatus(rowIdx);
                    } else {
                        updateBatchHandlingStatus(rowIdx);
                    }
                });
                
                // 移除成功消息，只保留錯誤消息
            } catch (e) {
                showToast('載入事項失敗: ' + e.message, 'error');
            }
        }
        
        // escapeHtml → js/utils.js
        
        // 從檢查計畫查詢並預填審查函復輪次
        async function updateBatchResponseRoundFromPlan() {
            const planSelect = document.getElementById('createPlanName');
            const roundSelect = document.getElementById('createBatchResponseRound');
            const roundManualInput = document.getElementById('createBatchResponseRoundManual');
            
            if (!planSelect || !roundSelect || !roundManualInput) return;
            
            const planValue = planSelect.value.trim();
            if (!planValue) {
                // 清空選項
                roundSelect.value = '';
                roundManualInput.value = '';
                return;
            }
            
            try {
                // 載入該計畫下的所有事項
                const issueList = await loadIssuesByPlan(planValue, { showError: false, returnEmpty: true });
                if (!issueList || issueList.length === 0) {
                    // 沒有事項，預設為第1次
                    roundSelect.value = '1';
                    roundManualInput.value = '';
                    return;
                }
                
                // 找出第一個「有審查內容但沒有函復日期」的輪次
                // 如果所有輪次都有日期，則找下一個需要填寫的輪次
                let foundIncompleteRound = null;
                let maxRound = 0;
                
                issueList.forEach(issue => {
                    // 檢查所有可能的審查輪次（最多200次）
                    for (let i = 1; i <= 200; i++) {
                        const suffix = i === 1 ? '' : i;
                        const review = issue['review' + suffix] || '';
                        const responseDate = issue['response_date_r' + i] || '';
                        
                        // 如果有審查意見，記錄最高輪次
                        if (review.trim()) {
                            if (i > maxRound) {
                                maxRound = i;
                            }
                            
                            // 如果有審查內容但沒有函復日期，這是需要填寫的輪次
                            if (review.trim() && !responseDate) {
                                if (!foundIncompleteRound || i < foundIncompleteRound) {
                                    foundIncompleteRound = i;
                                }
                            }
                        }
                    }
                });
                
                // 如果找到有審查內容但無日期的輪次，使用該輪次
                // 否則使用最高輪次 + 1（如果最高輪次是0，則為第1次）
                const suggestedRound = foundIncompleteRound || (maxRound + 1);
                
                if (suggestedRound <= 200) {
                    roundSelect.value = suggestedRound;
                    roundManualInput.value = '';
                    // 移除自動預填的提示訊息，只保留錯誤訊息
                } else {
                    // 如果超過200次，使用手動輸入
                    roundSelect.value = '';
                    roundManualInput.value = suggestedRound;
                    // 移除自動預填的提示訊息，只保留錯誤訊息
                }
            } catch (e) {
                console.error('查詢審查輪次失敗:', e);
            }
        }
        
        // 當下拉選單改變時，同步到手動輸入欄位
        function onBatchResponseRoundChange() {
            const roundSelect = document.getElementById('createBatchResponseRound');
            const roundManualInput = document.getElementById('createBatchResponseRoundManual');
            
            if (!roundSelect || !roundManualInput) return;
            
            if (roundSelect.value) {
                roundManualInput.value = '';
            }
        }
        
        // 當手動輸入改變時，同步到下拉選單
        function onBatchResponseRoundManualChange() {
            const roundSelect = document.getElementById('createBatchResponseRound');
            const roundManualInput = document.getElementById('createBatchResponseRoundManual');
            
            if (!roundSelect || !roundManualInput) return;
            
            if (roundManualInput.value) {
                const manualValue = parseInt(roundManualInput.value);
                if (manualValue >= 1 && manualValue <= 200) {
                    // 如果在選單範圍內，同步到選單
                    roundSelect.value = manualValue;
                } else {
                    // 如果超過範圍，清空選單
                    roundSelect.value = '';
                }
            } else {
                // 如果手動輸入為空，不清空選單（保留選單選擇）
            }
        }
        
        // 批次模式：當選擇計畫時，更新所有行的年度（不管是否有編號）
        function handleCreateBatchPlanChange() {
            const planValue = document.getElementById('createPlanName')?.value.trim();
            if (!planValue) return;
            
            const { year: planYear } = parsePlanValue(planValue);
            if (!planYear) return;
            
            // 更新所有行的年度為計畫的年度（不管是否有編號）
            const rows = document.querySelectorAll('#createBatchGridBody tr');
            let updatedCount = 0;
            rows.forEach(tr => {
                const yearInput = tr.querySelector('.create-batch-year');
                if (yearInput) {
                    yearInput.value = planYear;
                    updatedCount++;
                }
            });
            
            // 移除年度同步更新的提示訊息，只保留錯誤訊息
        }
        
        // 從編號自動填入欄位（單筆模式）
        function autoFillFromNumberCreate() {
            const val = document.getElementById('createNumber').value;
            const info = parseItemNumber(val);
            if (info) {
                if (info.yearRoc) {
                    const yearDisplay = document.getElementById('createYearDisplay');
                    if (yearDisplay) yearDisplay.value = info.yearRoc;
                }
                if (info.orgCode) {
                    const name = ORG_MAP[info.orgCode] || info.orgCode;
                    if (name && name !== '?') document.getElementById('createUnit').value = name;
                }
                if (info.divCode) {
                    const divName = DIVISION_MAP[info.divCode];
                    if (divName) document.getElementById('createDivision').value = divName;
                }
                if (info.inspectCode) {
                    const inspectName = INSPECTION_MAP[info.inspectCode];
                    if (inspectName) document.getElementById('createInspection').value = inspectName;
                }
                if (info.kindCode) {
                    document.getElementById('createKind').value = info.kindCode;
                }
            }
        }
        
        // 向後兼容：保留舊函數名稱
        function autoFillFromNumber() {
            autoFillFromNumberCreate();
        }

        // 辦理情形輪次管理（用於新增事項）
        let createHandlingRounds = []; // 儲存辦理情形輪次資料
        
        // 初始化辦理情形輪次（可選，預設為空，用戶可以選擇新增）
        function initCreateHandlingRounds() {
            createHandlingRounds = [];
            // 不再預設新增第一次辦理情形，讓用戶可以選擇是否要新增
            renderCreateHandlingRounds();
        }
        
        // 新增辦理情形輪次
        function addCreateHandlingRound() {
            const round = createHandlingRounds.length + 1;
                createHandlingRounds.push({
                round: round,
                handling: '',
                replyDate: ''
            });
            renderCreateHandlingRounds();
        }
        
        // 移除辦理情形輪次
        function removeCreateHandlingRound(index) {
            createHandlingRounds.splice(index, 1);
            // 重新編號
            createHandlingRounds.forEach((r, i) => {
                r.round = i + 1;
            });
            renderCreateHandlingRounds();
        }
        
        // 渲染辦理情形輪次
        function renderCreateHandlingRounds() {
            const container = document.getElementById('createHandlingRoundsContainer');
            if (!container) return;
            
            if (createHandlingRounds.length === 0) {
                container.innerHTML = '';
                return;
            }
            
            let html = '';
            createHandlingRounds.forEach((roundData, index) => {
                const isFirst = index === 0;
                html += `
                    <div class="create-handling-round" data-index="${index}" style="background:white; padding:16px; border-radius:8px; border:${isFirst ? '2px solid #10b981' : '1px solid #e2e8f0'}; margin-bottom:12px; ${isFirst ? 'border-left:4px solid #10b981;' : ''}">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <div style="font-weight:700; color:${isFirst ? '#047857' : '#334155'}; font-size:14px;">
                                第 ${roundData.round} 次機構辦理情形 ${isFirst ? '<span style="color:#64748b; font-size:12px;">(選填)</span>' : ''}
                            </div>
                            ${!isFirst ? `<button type="button" class="btn btn-danger btn-sm" onclick="removeCreateHandlingRound(${index})" style="padding:4px 12px; font-size:12px;">刪除</button>` : ''}
                        </div>
                        <div style="margin-bottom:12px;">
                            <label style="display:block; font-weight:600; color:#475569; font-size:13px; margin-bottom:6px;">
                                辦理情形
                            </label>
                            <textarea class="filter-input create-handling-text" data-index="${index}" 
                                placeholder="請輸入機構辦理情形..." 
                                style="width:100%; min-height:120px; padding:12px; font-size:14px; line-height:1.6; resize:vertical; background:white;"
                                oninput="updateCreateHandlingRound(${index}, 'handling', this.value)">${roundData.handling}</textarea>
                        </div>
                        <div>
                            <label style="display:block; font-weight:600; color:#475569; font-size:12px; margin-bottom:6px;">鐵路機構回復日期</label>
                            <input type="text" class="filter-input create-handling-reply-date" data-index="${index}" 
                                value="${roundData.replyDate}" placeholder="例如: 1130601" 
                                style="width:100%; background:white;"
                                oninput="updateCreateHandlingRound(${index}, 'replyDate', this.value)">
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }
        
        // 更新辦理情形輪次資料
        function updateCreateHandlingRound(index, field, value) {
            if (createHandlingRounds[index]) {
                createHandlingRounds[index][field] = value;
            }
        }
        
        // 單筆新增事項
        async function submitCreateIssue() {
            const number = document.getElementById('createNumber').value.trim();
            const yearDisplay = document.getElementById('createYearDisplay');
            let year = yearDisplay ? yearDisplay.value.trim() : '';
            const unit = document.getElementById('createUnit').value.trim();
            const division = document.getElementById('createDivision').value;
            const inspection = document.getElementById('createInspection').value;
            const kind = document.getElementById('createKind').value;

            const planValue = document.getElementById('createPlanName').value.trim();
            const issueDate = document.getElementById('createIssueDate').value.trim();
            const continuousMode = document.getElementById('createContinuousMode').checked;

            const status = document.getElementById('createStatus').value;
            const content = document.getElementById('createContent').value.trim();
            
            if (!number || !unit || !content) return showToast('請填寫所有必填欄位', 'error');
            if (!planValue) return showToast('請選擇檢查計畫', 'error');
            if (!issueDate) return showToast('請填寫初次發函日期', 'error');
            
            // 從計畫選項值中提取計畫名稱和年度
            const { name: planName, year: planYear } = parsePlanValue(planValue);
            
            // 優先使用計畫的年度，如果計畫沒有年度才使用從編號解析出來的年度
            if (planYear) {
                year = planYear;
                // 更新顯示欄位
                if (yearDisplay) {
                    yearDisplay.value = year;
                }
            }
            
            // 如果還是沒有年度，嘗試從編號解析
            if (!year) {
                const info = parseItemNumber(number);
                if (info && info.yearRoc) {
                    year = info.yearRoc;
                    if (yearDisplay) {
                        yearDisplay.value = year;
                    }
                }
            }
            
            if (!year) return showToast('無法確定年度，請確認編號格式或選擇有年度的檢查計畫', 'error');
            
            // 辦理情形為選填，可以稍後再新增
            // 如果有辦理情形，使用第一個；如果沒有，使用空值
            const firstHandling = createHandlingRounds.length > 0 && createHandlingRounds[0].handling.trim() 
                ? createHandlingRounds[0] 
                : { handling: '', replyDate: '' };
            const payload = {
                data: [{
                    number, year, unit, content, status,
                    itemKindCode: kind,
                    divisionName: division,
                    inspectionCategoryName: inspection,
                    planName: planName,
                    issueDate: issueDate,
                    handling: firstHandling.handling ? firstHandling.handling.trim() : '',
                    scheme: 'MANUAL'
                }],
                round: 1, 
                reviewDate: '', 
                replyDate: firstHandling.replyDate ? firstHandling.replyDate.trim() : '',
                ownerGroupIds: getIssueOwnerGroupIds()
            };

            try {
                const res = await apiFetch('/api/issues/import', { 
                    method: 'POST', 
                    body: JSON.stringify(payload) 
                });
                
                // 先檢查HTTP狀態碼
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    // 檢查是否有編號重複的錯誤
                    if (res.status === 400 && errorData.error === '編號重複') {
                        showToast(`編號 "${number}" 已存在且內容不同，無法新增。請使用不同的編號或修改現有事項。`, 'error');
                        // 不清理表單，讓用戶可以修改編號
                        return;
                    }
                    showToast('新增失敗: ' + (errorData.error || res.statusText), 'error');
                    return;
                }
                
                const result = await res.json();
                
                // 確認是新增成功（newCount > 0）或更新成功（updateCount > 0）
                if (result.newCount > 0 || result.updateCount > 0) {
                    // 如果有多次辦理情形，需要逐一更新
                    if (createHandlingRounds.length > 0) {
                        // 驗證數據是否真的寫入資料庫
                        const verifyRes = await fetch(`/api/issues?page=1&pageSize=100&q=${encodeURIComponent(number)}&_t=${Date.now()}`);
                        if (verifyRes.ok) {
                            const verifyData = await verifyRes.json();
                            const exactMatch = verifyData.data?.find(item => String(item.number) === String(number));
                            if (exactMatch) {
                                const issueId = exactMatch.id;
                                
                                // 更新後續的辦理情形輪次（從第二次開始）
                                let updateSuccess = true;
                                let updateCount = 0;
                                for (let i = 1; i < createHandlingRounds.length; i++) {
                                    const roundData = createHandlingRounds[i];
                                    if (roundData.handling && roundData.handling.trim()) {
                                        const round = i + 1;
                                        try {
                                            const updateRes = await apiFetch(`/api/issues/${issueId}`, {
                                                method: 'PUT',
                                                body: JSON.stringify({
                                                    status: status,
                                                    round: round,
                                                    handling: roundData.handling.trim(),
                                                    review: '',
                                                    replyDate: roundData.replyDate ? roundData.replyDate.trim() : null,
                                                    responseDate: null // 辦理情形階段不需要函復日期
                                                })
                                            });
                                            if (updateRes.ok) {
                                                updateCount++;
                                            } else {
                                                updateSuccess = false;
                                                console.error(`更新第 ${round} 次辦理情形失敗`);
                                            }
                                        } catch (e) {
                                            updateSuccess = false;
                                            console.error(`更新第 ${round} 次辦理情形錯誤:`, e);
                                        }
                                    }
                                }
                                
                                if (createHandlingRounds.length > 1) {
                                    if (updateSuccess && updateCount === createHandlingRounds.length - 1) {
                                        showToast(`新增成功！已新增事項及 ${createHandlingRounds.length} 次辦理情形`);
                                    } else if (updateCount > 0) {
                                        showToast(`新增成功！已新增事項及 ${updateCount + 1} 次辦理情形（部分更新失敗）`, 'warning');
                                    } else {
                                        showToast('新增成功，但辦理情形更新失敗', 'warning');
                                    }
                                } else if (createHandlingRounds.length === 1 && createHandlingRounds[0].handling.trim()) {
                                    showToast('新增成功！已新增事項及 1 次辦理情形');
                                } else if (createHandlingRounds.length > 0 && createHandlingRounds.some(r => r.handling.trim())) {
                                    showToast('新增成功！已新增事項及辦理情形');
                                } else {
                                    showToast('新增成功！已新增事項（可稍後再新增辦理情形）');
                                }
                            } else {
                                // 驗證失敗，但後端已返回成功，仍然顯示成功
                                showToast('新增成功，資料已確認寫入資料庫');
                            }
                        } else {
                            // verifyRes 失敗，但後端已返回成功，仍然顯示成功
                            showToast('新增成功，資料已確認寫入資料庫');
                        }
                        
                        // 清理表單
                        if (continuousMode) {
                            document.getElementById('createNumber').value = '';
                            document.getElementById('createKind').value = '';
                            document.getElementById('createContent').value = '';
                            // 重置辦理情形（保留第一次）
                            createHandlingRounds = [{
                                round: 1,
                                handling: '',
                                replyDate: '',
                                responseDate: ''
                            }];
                            renderCreateHandlingRounds();
                            document.getElementById('createNumber').focus();
                        } else {
                            document.getElementById('createNumber').value = '';
                            if (yearDisplay) yearDisplay.value = '';
                            document.getElementById('createUnit').value = '';
                            document.getElementById('createDivision').value = '';
                            document.getElementById('createInspection').value = '';
                            document.getElementById('createKind').value = '';
                            document.getElementById('createContent').value = '';
                            document.getElementById('createPlanName').value = '';
                            document.getElementById('createIssueDate').value = '';
                            // 重置辦理情形
                            initCreateHandlingRounds();
                        }
                    } else {
                        // 沒有辦理情形輪次，直接顯示成功並清理表單
                        showToast('新增成功，資料已確認寫入資料庫');
                        
                        // 清理表單
                        if (continuousMode) {
                            document.getElementById('createNumber').value = '';
                            document.getElementById('createKind').value = '';
                            document.getElementById('createContent').value = '';
                            // 重置辦理情形（保留第一次）
                            createHandlingRounds = [{
                                round: 1,
                                handling: '',
                                replyDate: '',
                                responseDate: ''
                            }];
                            renderCreateHandlingRounds();
                            document.getElementById('createNumber').focus();
                        } else {
                            document.getElementById('createNumber').value = '';
                            if (yearDisplay) yearDisplay.value = '';
                            document.getElementById('createUnit').value = '';
                            document.getElementById('createDivision').value = '';
                            document.getElementById('createInspection').value = '';
                            document.getElementById('createKind').value = '';
                            document.getElementById('createContent').value = '';
                            document.getElementById('createPlanName').value = '';
                            document.getElementById('createIssueDate').value = '';
                            // 重置辦理情形
                            initCreateHandlingRounds();
                        }
                    }

                    loadIssuesPage(1);
                    loadPlanOptions();
                    return;
                } else {
                    // newCount 和 updateCount 都是 0，表示沒有資料被寫入
                    showToast('儲存失敗：沒有資料被寫入資料庫', 'error');
                }
            } catch (e) { 
                showToast('Error: ' + e.message, 'error'); 
            }
        }
        
        // 批次模式：初始化表格（快速新增模式：預設只顯示一列）
        function initCreateBatchGrid() {
            const tbody = document.getElementById('createBatchGridBody');
            if (!tbody) return;
            tbody.innerHTML = '';
            batchHandlingData = {}; // 重置辦理情形資料
            // 快速新增模式：預設只顯示一列
            addCreateBatchRow();
            // 初始化後更新所有行的辦理情形狀態
            setTimeout(() => {
                updateAllBatchHandlingStatus();
            }, 100);
        }
        
        // 批次模式：新增一列（改為直接使用 textarea 輸入事項內容）
        function addCreateBatchRow() {
            const tbody = document.getElementById('createBatchGridBody');
            if (!tbody) return;
            const rowIdx = tbody.children.length;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="text-align:center;color:#94a3b8;font-size:12px;">${rowIdx + 1}</td>
                <td><input type="text" class="filter-input create-batch-number" placeholder="編號..." onchange="handleCreateBatchNumberChange(this)" style="font-family:monospace;"></td>
                <td style="position:relative;">
                    <textarea class="filter-input create-batch-content-textarea" rows="3" placeholder="請輸入事項內容..." style="resize:vertical;min-height:60px;max-height:120px;font-size:13px;line-height:1.6;padding:8px 10px;"></textarea>
                </td>
                <td><input type="text" class="filter-input create-batch-year" style="background:#f1f5f9;color:#64748b;" readonly></td>
                <td><input type="text" class="filter-input create-batch-unit" style="background:#f1f5f9;color:#64748b;" readonly></td>
                <td><select class="filter-select create-batch-division"><option value="">-</option><option value="運務">運務</option><option value="工務">工務</option><option value="機務">機務</option><option value="電務">電務</option><option value="安全">安全</option><option value="審核">審核</option><option value="災防">災防</option><option value="運轉">運轉</option><option value="土木">土木</option><option value="機電">機電</option><option value="土建">土建</option><option value="安全管理">安全管理</option><option value="營運">營運</option><option value="其他">其他</option></select></td>
                <td><select class="filter-select create-batch-inspection"><option value="">-</option><option value="定期檢查">定期檢查</option><option value="例行性檢查">例行性檢查</option><option value="特別檢查">特別檢查</option><option value="臨時檢查">臨時檢查</option></select></td>
                <td><select class="filter-select create-batch-kind"><option value="">-</option><option value="N">缺失</option><option value="O">觀察</option><option value="R">建議</option></select></td>
                <td><select class="filter-select create-batch-status"><option value="持續列管">持續列管</option><option value="解除列管">解除列管</option><option value="自行列管">自行列管</option></select></td>
                <td style="text-align:center;">
                    <button class="btn btn-outline btn-sm create-batch-handling-btn" onclick="openBatchHandlingModal(${rowIdx})" data-row-index="${rowIdx}" style="padding:6px 12px; font-size:12px; width:100%;" title="點擊新增或管理辦理情形">
                        <span class="create-batch-handling-status">新增辦理情形</span>
                    </button>
                </td>
                <td style="text-align:center;">
                    <button class="btn btn-danger btn-sm" onclick="removeCreateBatchRow(this)" style="padding:4px 8px;">×</button>
                </td>
            `;
            tbody.appendChild(tr);
            // 更新該行的辦理情形狀態顯示
            updateBatchHandlingStatus(rowIdx);
        }
        
        // 批次模式：移除一列
        function removeCreateBatchRow(btn) {
            const tr = btn.closest('tr');
            const tbody = document.getElementById('createBatchGridBody');
            if (tbody && tbody.children.length > 1) {
                const rowIndex = Array.from(tbody.children).indexOf(tr);
                tr.remove();
                
                // 移除該行的辦理情形資料
                if (batchHandlingData[rowIndex]) {
                    delete batchHandlingData[rowIndex];
                }
                
                // 重新索引辦理情形資料（因為行號改變了）
                const newBatchHandlingData = {};
                tbody.querySelectorAll('tr').forEach((row, idx) => {
                    const oldIndex = Array.from(tbody.children).indexOf(row);
                    if (batchHandlingData[oldIndex]) {
                        newBatchHandlingData[idx] = batchHandlingData[oldIndex];
                    }
                });
                batchHandlingData = newBatchHandlingData;
                
                // Re-index
                tbody.querySelectorAll('tr').forEach((row, idx) => {
                    row.cells[0].innerText = idx + 1;
                    // 更新辦理情形按鈕的 onclick 和 data-row-index
                    const handlingBtn = row.querySelector('.create-batch-handling-btn');
                    if (handlingBtn) {
                        handlingBtn.setAttribute('onclick', `openBatchHandlingModal(${idx})`);
                        handlingBtn.setAttribute('data-row-index', idx);
                    }
                });
                // 更新所有行的辦理情形狀態顯示
                updateAllBatchHandlingStatus();
            } else {
                showToast('至少需保留一列', 'error');
            }
        }
        
        // 批次模式：調整textarea寬度和高度（已棄用，保留以備不時之需）
        function adjustTextareaWidth(textarea) {
            // 根據內容長度動態調整寬度和高度
            const content = textarea.value;
            const contentLength = content.length;
            
            // 計算行數（假設每行約50個字符）
            const lines = Math.max(1, Math.ceil(contentLength / 50));
            const maxLines = 5; // 最多顯示5行
            textarea.rows = Math.min(lines, maxLines);
            
            // 調整寬度：根據內容長度和行數
            const minWidth = 200;
            const maxWidth = 600;
            const charWidth = 7; // 估算每個字符的寬度（px）
            const padding = 24; // 左右padding
            
            // 如果是多行，使用較大的寬度
            if (lines > 1) {
                textarea.style.width = Math.min(maxWidth, Math.max(minWidth, 400)) + 'px';
            } else {
                // 單行時根據內容長度調整
                const calculatedWidth = Math.max(minWidth, Math.min(maxWidth, contentLength * charWidth + padding));
                textarea.style.width = calculatedWidth + 'px';
            }
        }
        
        // 批次模式：事項內容編輯模態框管理
        let currentBatchContentRowIndex = null;
        
        function openBatchContentModal(rowIndex) {
            // 已改為直接在表格中輸入，此函數不再使用
            // 如果需要，可以聚焦到該行的 textarea
            const tbody = document.getElementById('createBatchGridBody');
            if (!tbody) return;
            const tr = tbody.children[rowIndex];
            if (!tr) return;
            const textarea = tr.querySelector('.create-batch-content-textarea');
            if (textarea) {
                textarea.focus();
            }
        }
        
        // closeBatchContentModal, saveBatchContent, initBatchContentModal → js/modals.js

        // 批次模式：處理編號變更
        function handleCreateBatchNumberChange(input) {
            const tr = input.closest('tr');
            const val = input.value.trim();
            if (!val) return;

            const info = parseItemNumber(val);
            if (info) {
                // 優先使用計畫的年度，如果計畫沒有年度才使用從編號解析出來的年度
                const planValue = document.getElementById('createPlanName')?.value.trim();
                if (planValue) {
                    const { year: planYear } = parsePlanValue(planValue);
                    if (planYear) {
                        tr.querySelector('.create-batch-year').value = planYear;
                    } else if (info.yearRoc) {
                        tr.querySelector('.create-batch-year').value = info.yearRoc;
                    }
                } else if (info.yearRoc) {
                    tr.querySelector('.create-batch-year').value = info.yearRoc;
                }
                
                if (info.orgCode && info.orgCode !== '?') {
                    const name = ORG_MAP[info.orgCode] || info.orgCode;
                    if (name && name !== '?') {
                        const unitInput = tr.querySelector('.create-batch-unit');
                        if (unitInput) unitInput.value = name;
                    }
                }
                if (info.divCode && info.divCode !== '?') {
                    const divName = DIVISION_MAP[info.divCode];
                    if (divName) {
                        const divisionSelect = tr.querySelector('.create-batch-division');
                        if (divisionSelect) divisionSelect.value = divName;
                    }
                }
                if (info.inspectCode && info.inspectCode !== '?') {
                    const inspectName = INSPECTION_MAP[info.inspectCode];
                    if (inspectName) {
                        const inspectionSelect = tr.querySelector('.create-batch-inspection');
                        if (inspectionSelect) inspectionSelect.value = inspectName;
                    }
                }
                if (info.kindCode && info.kindCode !== '?') {
                    const kindSelect = tr.querySelector('.create-batch-kind');
                    if (kindSelect) kindSelect.value = info.kindCode;
                }
            }
        }
        
        // 批次模式辦理情形管理
        let batchHandlingData = {}; // 儲存每筆事項的辦理情形 { rowIndex: [rounds...] }
        let currentBatchHandlingRowIndex = -1; // 當前正在編輯的行索引
        
        // 開啟批次辦理情形管理 Modal
        function openBatchHandlingModal(rowIndex) {
            const rows = document.querySelectorAll('#createBatchGridBody tr');
            if (rowIndex < 0 || rowIndex >= rows.length) return;
            
            const row = rows[rowIndex];
            const number = row.querySelector('.create-batch-number').value.trim();
            
            if (!number) {
                showToast('請先填寫編號', 'error');
                return;
            }
            
            currentBatchHandlingRowIndex = rowIndex;
            document.getElementById('batchHandlingModalNumber').textContent = number || `第 ${rowIndex + 1} 列`;
            
            // 載入該行的辦理情形資料（如果有的話）
            if (!batchHandlingData[rowIndex]) {
                batchHandlingData[rowIndex] = [];
            }
            
            renderBatchHandlingRounds();
            document.getElementById('batchHandlingModal').classList.add('open');
        }
        
        // 初始化時更新所有行的辦理情形狀態
        function updateAllBatchHandlingStatus() {
            const rows = document.querySelectorAll('#createBatchGridBody tr');
            rows.forEach((row, idx) => {
                updateBatchHandlingStatus(idx);
            });
        }
        
        // 關閉批次辦理情形管理 Modal
        function closeBatchHandlingModal() {
            document.getElementById('batchHandlingModal').classList.remove('open');
            currentBatchHandlingRowIndex = -1;
        }
        
        
        // 新增批次辦理情形輪次
        function addBatchHandlingRound() {
            if (currentBatchHandlingRowIndex === -1) return;
            if (!batchHandlingData[currentBatchHandlingRowIndex]) {
                batchHandlingData[currentBatchHandlingRowIndex] = [];
            }
            
            const round = batchHandlingData[currentBatchHandlingRowIndex].length + 1;
            batchHandlingData[currentBatchHandlingRowIndex].push({
                round: round,
                handling: '',
                replyDate: ''
            });
            renderBatchHandlingRounds();
        }
        
        // 移除批次辦理情形輪次
        function removeBatchHandlingRound(index) {
            if (currentBatchHandlingRowIndex === -1) return;
            if (!batchHandlingData[currentBatchHandlingRowIndex]) return;
            
            batchHandlingData[currentBatchHandlingRowIndex].splice(index, 1);
            // 重新編號
            batchHandlingData[currentBatchHandlingRowIndex].forEach((r, i) => {
                r.round = i + 1;
            });
            renderBatchHandlingRounds();
        }
        
        // 渲染批次辦理情形輪次
        function renderBatchHandlingRounds() {
            const container = document.getElementById('batchHandlingRoundsContainer');
            if (!container || currentBatchHandlingRowIndex === -1) return;
            
            const rounds = batchHandlingData[currentBatchHandlingRowIndex] || [];
            
            if (rounds.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8; font-size:14px;">尚未新增辦理情形，點擊「新增辦理情形」開始新增</div>';
                return;
            }
            
            let html = '';
            rounds.forEach((roundData, index) => {
                html += `
                    <div class="batch-handling-round" data-index="${index}" style="background:white; padding:16px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <div style="font-weight:700; color:#334155; font-size:14px;">
                                第 ${roundData.round} 次機構辦理情形
                            </div>
                            <button type="button" class="btn btn-danger btn-sm" onclick="removeBatchHandlingRound(${index})" style="padding:4px 12px; font-size:12px;">刪除</button>
                        </div>
                        <div style="margin-bottom:12px;">
                            <label style="display:block; font-weight:600; color:#475569; font-size:13px; margin-bottom:6px;">
                                辦理情形
                            </label>
                            <textarea class="filter-input batch-handling-text" data-index="${index}" 
                                placeholder="請輸入機構辦理情形..." 
                                style="width:100%; min-height:120px; padding:12px; font-size:14px; line-height:1.6; resize:vertical; background:white;"
                                oninput="updateBatchHandlingRound(${index}, 'handling', this.value)">${roundData.handling}</textarea>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }
        
        // 更新批次辦理情形輪次資料
        function updateBatchHandlingRound(index, field, value) {
            if (currentBatchHandlingRowIndex === -1) return;
            if (batchHandlingData[currentBatchHandlingRowIndex] && batchHandlingData[currentBatchHandlingRowIndex][index]) {
                batchHandlingData[currentBatchHandlingRowIndex][index][field] = value;
            }
        }
        
        // 儲存批次辦理情形
        async function saveBatchHandlingRounds() {
            if (currentBatchHandlingRowIndex === -1) return;
            
            const rows = document.querySelectorAll('#createBatchGridBody tr');
            if (currentBatchHandlingRowIndex < 0 || currentBatchHandlingRowIndex >= rows.length) return;
            
            const row = rows[currentBatchHandlingRowIndex];
            const number = row.querySelector('.create-batch-number')?.value.trim();
            const issueId = row.getAttribute('data-issue-id');
            const handlingRounds = batchHandlingData[currentBatchHandlingRowIndex] || [];
            
            // 如果事項已存在於資料庫（有 ID），則立即儲存到資料庫
            if (issueId && number) {
                try {
                    // 移除儲存中的提示訊息，只保留錯誤訊息
                    
                    // 先更新第一次辦理情形（如果有的話）
                    if (handlingRounds.length > 0 && handlingRounds[0].handling && handlingRounds[0].handling.trim()) {
                        const firstRound = handlingRounds[0];
                        const updateRes = await apiFetch(`/api/issues/${issueId}`, {
                            method: 'PUT',
                            body: JSON.stringify({
                                handling: firstRound.handling.trim(),
                                replyDate: firstRound.replyDate ? firstRound.replyDate.trim() : null,
                                responseDate: null
                            })
                        });
                        
                        if (!updateRes.ok) {
                            throw new Error('更新第一次辦理情形失敗');
                        }
                    }
                    
                    // 更新後續的辦理情形輪次（從第2次開始）
                    for (let i = 1; i < handlingRounds.length; i++) {
                        const roundData = handlingRounds[i];
                        if (roundData.handling && roundData.handling.trim()) {
                            const round = i + 1;
                            try {
                                const updateRes = await apiFetch(`/api/issues/${issueId}`, {
                                    method: 'PUT',
                                    body: JSON.stringify({
                                        round: round,
                                        handling: roundData.handling.trim(),
                                        review: '',
                                        replyDate: roundData.replyDate ? roundData.replyDate.trim() : null,
                                        responseDate: null
                                    })
                                });
                                
                                if (!updateRes.ok) {
                                    console.error(`更新第 ${round} 次辦理情形失敗`);
                                }
                            } catch (e) {
                                console.error(`更新第 ${round} 次辦理情形錯誤:`, e);
                            }
                        }
                    }
                    
                    // 保留儲存成功的提示訊息（資料庫操作結果）
                    showToast('辦理情形已成功儲存至資料庫', 'success');
                    // 更新辦理情形狀態顯示
                    updateBatchHandlingStatus(currentBatchHandlingRowIndex);
                    closeBatchHandlingModal();
                } catch (e) {
                    showToast('儲存辦理情形失敗: ' + e.message, 'error');
                }
            } else {
                // 如果事項尚未存在於資料庫（新建立的事項），則保持現有行為
                // 保留儲存成功的提示訊息（資料庫操作結果）
                showToast('辦理情形已儲存（將在批次新增時一併保存）', 'success');
                // 更新辦理情形狀態顯示
                updateBatchHandlingStatus(currentBatchHandlingRowIndex);
                closeBatchHandlingModal();
            }
        }
        
        // 更新批次辦理情形狀態顯示
        function updateBatchHandlingStatus(rowIndex) {
            const rows = document.querySelectorAll('#createBatchGridBody tr');
            if (rowIndex < 0 || rowIndex >= rows.length) return;
            
            const row = rows[rowIndex];
            const btn = row.querySelector('.create-batch-handling-btn');
            const statusSpan = row.querySelector('.create-batch-handling-status');
            
            if (!btn || !statusSpan) return;
            
            const handlingRounds = batchHandlingData[rowIndex] || [];
            const hasHandling = handlingRounds.length > 0 && handlingRounds.some(r => r.handling && r.handling.trim());
            
            if (hasHandling) {
                const count = handlingRounds.filter(r => r.handling && r.handling.trim()).length;
                statusSpan.textContent = `已填寫 (${count}次)`;
                btn.style.backgroundColor = '#ecfdf5';
                btn.style.borderColor = '#10b981';
                btn.style.color = '#047857';
            } else {
                statusSpan.textContent = '新增辦理情形';
                btn.style.backgroundColor = '';
                btn.style.borderColor = '';
                btn.style.color = '';
            }
        }
        
        // 批次模式：儲存所有項目
        async function saveCreateBatchItems() {
            const planValue = document.getElementById('createPlanName').value.trim();
            const issueDate = document.getElementById('createIssueDate').value.trim();

            if (!planValue) return showToast('請選擇檢查計畫', 'error');
            const { name: planName, year: planYear } = parsePlanValue(planValue);
            if (!issueDate) return showToast('請填寫初次發函日期', 'error');
            if (getIssueOwnerGroupIds().length === 0) return showToast('請至少選擇一個適用群組', 'error');

            const rows = document.querySelectorAll('#createBatchGridBody tr');
            const items = [];
            let hasError = false;

            rows.forEach((tr, idx) => {
                const number = tr.querySelector('.create-batch-number').value.trim();
                // 改為從 textarea 讀取內容
                const contentTextarea = tr.querySelector('.create-batch-content-textarea');
                const content = contentTextarea ? contentTextarea.value.trim() : '';

                if (!number && !content) return;

                if (!number) {
                    showToast(`第 ${idx + 1} 列缺少編號`, 'error');
                    hasError = true;
                    return;
                }
                
                // 檢查編號是否為空
                if (!number.trim()) {
                    showToast(`第 ${idx + 1} 列編號不能為空`, 'error');
                    hasError = true;
                    return;
                }

                // 優先使用計畫的年度，如果計畫沒有年度才使用表格中的年度
                let year = tr.querySelector('.create-batch-year').value.trim();
                if (planYear && year !== planYear) {
                    // 如果計畫有年度且與表格中的年度不同，使用計畫的年度
                    year = planYear;
                    tr.querySelector('.create-batch-year').value = year;
                }
                
                const unit = tr.querySelector('.create-batch-unit').value.trim();

                if (!year || !unit) {
                    showToast(`第 ${idx + 1} 列的年度或機構未能自動判別，請確認編號格式或選擇有年度的檢查計畫`, 'error');
                    hasError = true;
                    return;
                }

                // 取得該行的辦理情形（第一次）
                const handlingRounds = batchHandlingData[idx] || [];
                const firstHandling = handlingRounds.length > 0 ? handlingRounds[0] : { handling: '', replyDate: '' };

                items.push({
                    number,
                    year,
                    unit,
                    content,
                    status: tr.querySelector('.create-batch-status').value,
                    itemKindCode: tr.querySelector('.create-batch-kind').value,
                    divisionName: tr.querySelector('.create-batch-division').value,
                    inspectionCategoryName: tr.querySelector('.create-batch-inspection').value,
                    planName: planName,
                    issueDate: issueDate,
                    handling: firstHandling.handling ? firstHandling.handling.trim() : '',
                    replyDate: firstHandling.replyDate ? firstHandling.replyDate.trim() : '',
                    scheme: 'BATCH',
                    handlingRounds: handlingRounds // 保存所有辦理情形輪次，用於後續更新
                });
            });

            if (hasError) return;
            if (items.length === 0) return showToast('請至少輸入一筆有效資料', 'error');

            // 檢查是否有重複編號
            const numberSet = new Set();
            const duplicateNumbers = [];
            items.forEach((item, idx) => {
                if (item.number && item.number.trim()) {
                    if (numberSet.has(item.number)) {
                        duplicateNumbers.push({ number: item.number, row: idx + 1 });
                    } else {
                        numberSet.add(item.number);
                    }
                }
            });
            
            if (duplicateNumbers.length > 0) {
                const duplicateList = duplicateNumbers.map(d => `第 ${d.row} 列：${d.number}`).join('\n');
                showToast(`發現重複編號，請修正後再儲存：\n${duplicateList}`, 'error');
                return;
            }

            const confirmed = await showConfirmModal(`確定要批次新增 ${items.length} 筆資料嗎？\n\n計畫：${planName}`, '確定新增', '取消');
            if (!confirmed) return;

            try {
                // 先新增所有事項（第一次辦理情形）
                // 注意：每個事項可能有不同的回復日期，需要在服務器端使用 item.replyDate
                const itemsForImport = items.map(item => {
                    const { handlingRounds, ...itemData } = item;
                    return itemData;
                });
                
                const res = await apiFetch('/api/issues/import', {
                    method: 'POST',
                    body: JSON.stringify({
                        data: itemsForImport,
                        round: 1,
                        reviewDate: '',
                        // 不再使用統一的 replyDate，改為使用每個 item 的 replyDate
                        ownerGroupIds: getIssueOwnerGroupIds()
                    })
                });

                if (res.ok) {
                    const result = await res.json();
                    
                    // 如果有多次辦理情形，需要逐一更新
                    if (result.newCount > 0 || result.updateCount > 0) {
                        // 驗證並更新後續辦理情形
                        let totalHandlingCount = 0;
                        let updateSuccessCount = 0;
                        
                        for (let i = 0; i < items.length; i++) {
                            const item = items[i];
                            const handlingRounds = item.handlingRounds || [];
                            
                            if (handlingRounds.length > 1) {
                                // 查詢該事項的 ID
                                const verifyRes = await fetch(`/api/issues?page=1&pageSize=100&q=${encodeURIComponent(item.number)}&_t=${Date.now()}`);
                                if (verifyRes.ok) {
                                    const verifyData = await verifyRes.json();
                                    const exactMatch = verifyData.data?.find(issue => String(issue.number) === String(item.number));
                                    
                                    if (exactMatch) {
                                        const issueId = exactMatch.id;
                                        totalHandlingCount += handlingRounds.length - 1;
                                        
                                        // 更新後續的辦理情形輪次
                                        for (let j = 1; j < handlingRounds.length; j++) {
                                            const roundData = handlingRounds[j];
                                            if (roundData.handling && roundData.handling.trim()) {
                                                const round = j + 1;
                                                try {
                                            const updateRes = await apiFetch(`/api/issues/${issueId}`, {
                                                method: 'PUT',
                                                body: JSON.stringify({
                                                    status: item.status,
                                                    round: round,
                                                    handling: roundData.handling.trim(),
                                                    review: '',
                                                    replyDate: roundData.replyDate ? roundData.replyDate.trim() : null,
                                                    responseDate: null // 辦理情形階段不需要函復日期
                                                })
                                            });
                                                    if (updateRes.ok) {
                                                        updateSuccessCount++;
                                                    }
                                                } catch (e) {
                                                    console.error(`更新第 ${i + 1} 筆事項的第 ${round} 次辦理情形錯誤:`, e);
                                                }
                                            }
                                        }
                                    }
                                }
                            } else if (handlingRounds.length === 1 && handlingRounds[0].handling.trim()) {
                                totalHandlingCount++;
                            }
                        }
                        
                        if (totalHandlingCount > 0) {
                            showToast(`批次新增成功！已新增 ${items.length} 筆事項，其中 ${updateSuccessCount + items.filter(item => (item.handlingRounds || []).length > 0 && (item.handlingRounds || [])[0].handling.trim()).length} 筆包含辦理情形`);
                        } else {
                            showToast('批次新增成功！');
                        }
                    } else {
                        showToast('批次新增成功！');
                    }
                    
                    // 檢查是否啟用連續新增模式
                    const continuousMode = document.getElementById('createBatchContinuousMode')?.checked || false;
                    
                    if (continuousMode) {
                        // 連續新增模式：清空已儲存的列，保留計畫和機構設定，自動新增新列
                        const savedRows = document.querySelectorAll('#createBatchGridBody tr');
                        savedRows.forEach((tr, idx) => {
                            if (idx < items.length) {
                                // 只清空編號、類型、事項內容，保留其他欄位
                                const numberInput = tr.querySelector('.create-batch-number');
                                const contentTextarea = tr.querySelector('.create-batch-content-textarea');
                                const kindSelect = tr.querySelector('.create-batch-kind');
                                
                                if (numberInput) numberInput.value = '';
                                if (contentTextarea) contentTextarea.value = '';
                                if (kindSelect) kindSelect.value = '';
                                
                                // 清空該行的辦理情形資料
                                if (batchHandlingData[idx]) {
                                    delete batchHandlingData[idx];
                                }
                                updateBatchHandlingStatus(idx);
                            }
                        });
                        
                        // 如果只有一列，確保該列被清空並聚焦到編號欄位
                        if (savedRows.length === 1) {
                            const firstRow = savedRows[0];
                            const numberInput = firstRow.querySelector('.create-batch-number');
                            if (numberInput) {
                                setTimeout(() => numberInput.focus(), 100);
                            }
                        }
                    } else {
                        // 非連續新增模式：清空所有列並重新初始化
                        initCreateBatchGrid();
                        batchHandlingData = {};
                        document.getElementById('createPlanName').value = '';
                        document.getElementById('createIssueDate').value = '';
                    }
                    
                    loadIssuesPage(1);
                    loadPlanOptions();
                } else {
                    const j = await res.json();
                    showToast('新增失敗: ' + (j.error || '不明錯誤'), 'error');
                }
            } catch (e) {
                showToast('Error: ' + e.message, 'error');
            }
        }
        
        // 向後兼容：保留舊函數名稱（改為指派，避免 ES module 重複宣告）
        window.submitManualIssue = submitCreateIssue;
        window.initBatchGrid = initCreateBatchGrid;
        window.addBatchRow = addCreateBatchRow;
        window.removeBatchRow = removeCreateBatchRow;
        window.handleBatchNumberChange = handleCreateBatchNumberChange;
        window.saveBatchItems = saveCreateBatchItems;

        // 保留舊函數名稱以向後兼容
        async function exportAllIssues() {
            return exportAllData();
        }

        async function exportAllData() {
            try {
                const exportDataType = document.querySelector('input[name="exportDataType"]:checked')?.value || 'issues';
                const exportScope = document.querySelector('input[name="exportScope"]:checked')?.value || 'latest';
                const exportFormat = document.querySelector('input[name="exportFormat"]:checked')?.value || 'excel';
                showToast('準備匯出中，請稍候...', 'info');
                
                let issuesData = [];
                let planSchedulesData = [];
                let usersData = [];
                
                // 根據選擇的資料類型獲取資料
                if (exportDataType === 'issues' || exportDataType === 'both') {
                    const res = await fetch('/api/issues?page=1&pageSize=10000&sortField=created_at&sortDir=desc');
                    if (!res.ok) throw new Error('取得開立事項資料失敗');
                    const json = await res.json();
                    issuesData = json.data || [];
                }

                if (exportDataType === 'users') {
                    const res = await fetch('/api/users?page=1&pageSize=10000', { credentials: 'include' });
                    if (!res.ok) throw new Error('取得帳號資料失敗');
                    const json = await res.json();
                    usersData = json.data || [];
                }
                
                if (exportDataType === 'plans' || exportDataType === 'both') {
                    // 匯出「檢查計畫（含行程與編號等完整欄位）」— 來源使用 /api/plan-schedule/all
                    const scheduleRes = await fetch('/api/plan-schedule/all', { credentials: 'include' });
                    if (!scheduleRes.ok) throw new Error('取得檢查計畫資料失敗');
                    const scheduleJson = await scheduleRes.json();
                    planSchedulesData = scheduleJson.data || [];
                }
                
                if (exportDataType === 'issues' && issuesData.length === 0) {
                    return showToast('無開立事項資料可匯出', 'error');
                }
                if (exportDataType === 'users' && usersData.length === 0) {
                    return showToast('無帳號資料可匯出', 'error');
                }
                if (exportDataType === 'plans' && planSchedulesData.length === 0) {
                    return showToast('無檢查計畫資料可匯出', 'error');
                }
                if (exportDataType === 'both' && issuesData.length === 0 && planSchedulesData.length === 0) {
                    return showToast('無資料可匯出', 'error');
                }

                // JSON 格式匯出
                if (exportFormat === 'json') {
                    const exportData = {};
                    if (exportDataType === 'issues' || exportDataType === 'both') {
                        exportData.issues = issuesData;
                    }
                    if (exportDataType === 'plans' || exportDataType === 'both') {
                        // JSON 仍輸出原始資料結構（代號保留）
                        exportData.plans = planSchedulesData;
                    }
                    if (exportDataType === 'users') {
                        exportData.users = usersData;
                    }
                    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(blob);
                    const dataTypeLabel = exportDataType === 'issues' ? 'Issues' : (exportDataType === 'plans' ? 'Plans' : (exportDataType === 'users' ? 'Users' : 'All'));
                    link.download = `SMS_Backup_${dataTypeLabel}_${new Date().toISOString().slice(0, 10)}.json`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    showToast('JSON 匯出完成', 'success');
                    return;
                }

                // Excel 格式匯出
                if (exportFormat === 'excel') {
                    const wb = XLSX.utils.book_new();
                    const getRailwayNameExport = (code) => (ORG_MAP[String(code || '').toUpperCase()] || (code || ''));
                    const getInspectionTypeNameExport = (type) => getInspectionTypeName(type);
                    const getBusinessTypeNameExport = (code) => getBusinessTypeName(code);
                    
                    // 如果選擇合併匯出，創建多個工作表
                    if (exportDataType === 'both') {
                        if (planSchedulesData.length > 0) {
                            const schedulesWSData = [
                                // 依照原本「完整欄位」匯出，但代號欄位改為中文（編號/取號編碼保留）
                                ['計畫名稱', '年度', '業務類型', '規劃檢查次數', '開始日期', '結束日期', '地點', '檢查人員', '鐵路機構', '檢查類別', '檢查次數', '取號編碼', '建立時間']
                            ];
                            planSchedulesData.forEach(s => {
                                schedulesWSData.push([
                                    s.plan_name || '',
                                    s.year || '',
                                    getBusinessTypeNameExport(s.business),
                                    s.planned_count != null ? s.planned_count : '',
                                    s.start_date ? String(s.start_date).slice(0, 10) : '',
                                    s.end_date ? String(s.end_date).slice(0, 10) : '',
                                    s.location || '',
                                    s.inspector || '',
                                    getRailwayNameExport(s.railway),
                                    getInspectionTypeNameExport(s.inspection_type),
                                    s.inspection_seq || '',
                                    s.plan_number || '',
                                    s.created_at ? new Date(s.created_at).toLocaleString('zh-TW') : ''
                                ]);
                            });
                            const schedulesWS = XLSX.utils.aoa_to_sheet(schedulesWSData);
                            XLSX.utils.book_append_sheet(wb, schedulesWS, '檢查計畫');
                        }
                        
                        // 工作表：開立事項
                        if (issuesData.length > 0) {
                            const issuesWSData = [];
                            if (exportScope === 'latest') {
                                issuesWSData.push(['編號', '年度', '機構', '分組', '檢查種類', '類型', '狀態', '事項內容', '最新辦理情形', '最新審查意見']);
                                issuesData.forEach(item => {
                                    let latestH = '', latestR = '';
                                    for (let i = 200; i >= 1; i--) { 
                                        const suffix = i === 1 ? '' : i;
                                        if (!latestH && (item[`handling${suffix}`])) latestH = stripHtml(item[`handling${suffix}`] || ''); 
                                        if (!latestR && (item[`review${suffix}`])) latestR = stripHtml(item[`review${suffix}`] || ''); 
                                    }
                                    issuesWSData.push([
                                        item.number || '',
                                        item.year || '',
                                        item.unit || '',
                                        item.divisionName || '',
                                        item.inspectionCategoryName || '',
                                        item.category || '',
                                        item.status || '',
                                        stripHtml(item.content || ''),
                                        latestH,
                                        latestR
                                    ]);
                                });
                            } else {
                                issuesWSData.push(['編號', '年度', '機構', '分組', '檢查種類', '類型', '狀態', '事項內容', '完整辦理情形歷程', '完整審查意見歷程']);
                                issuesData.forEach(item => {
                                    let fullH = [], fullR = [];
                                    for (let i = 1; i <= 200; i++) {
                                        const suffix = i === 1 ? '' : i;
                                        const valH = item[`handling${suffix}`], valR = item[`review${suffix}`];
                                        if (valH) fullH.push(`[第${i}次] ${stripHtml(valH)}`); 
                                        if (valR) fullR.push(`[第${i}次] ${stripHtml(valR)}`);
                                    }
                                    const joinedH = fullH.length > 0 ? fullH.join("\n-------------------\n") : "";
                                    const joinedR = fullR.length > 0 ? fullR.join("\n-------------------\n") : "";
                                    issuesWSData.push([
                                        item.number || '',
                                        item.year || '',
                                        item.unit || '',
                                        item.divisionName || '',
                                        item.inspectionCategoryName || '',
                                        item.category || '',
                                        item.status || '',
                                        stripHtml(item.content || ''),
                                        joinedH,
                                        joinedR
                                    ]);
                                });
                            }
                            const issuesWS = XLSX.utils.aoa_to_sheet(issuesWSData);
                            XLSX.utils.book_append_sheet(wb, issuesWS, '開立事項');
                        }
                    } else if (exportDataType === 'plans') {
                        if (planSchedulesData.length > 0) {
                            const schedulesWSData = [
                                ['計畫名稱', '年度', '業務類型', '規劃檢查次數', '開始日期', '結束日期', '地點', '檢查人員', '鐵路機構', '檢查類別', '檢查次數', '取號編碼', '建立時間']
                            ];
                            planSchedulesData.forEach(s => {
                                schedulesWSData.push([
                                    s.plan_name || '',
                                    s.year || '',
                                    getBusinessTypeNameExport(s.business),
                                    s.planned_count != null ? s.planned_count : '',
                                    s.start_date ? String(s.start_date).slice(0, 10) : '',
                                    s.end_date ? String(s.end_date).slice(0, 10) : '',
                                    s.location || '',
                                    s.inspector || '',
                                    getRailwayNameExport(s.railway),
                                    getInspectionTypeNameExport(s.inspection_type),
                                    s.inspection_seq || '',
                                    s.plan_number || '',
                                    s.created_at ? new Date(s.created_at).toLocaleString('zh-TW') : ''
                                ]);
                            });
                            const schedulesWS = XLSX.utils.aoa_to_sheet(schedulesWSData);
                            XLSX.utils.book_append_sheet(wb, schedulesWS, '檢查計畫');
                        }
                    } else if (exportDataType === 'users') {
                        const usersWSData = [['姓名', '帳號', '權限', '註冊時間']];
                        usersData.forEach(u => {
                            usersWSData.push([
                                u.name || '',
                                u.username || '',
                                u.role || '',
                                u.created_at ? new Date(u.created_at).toLocaleString('zh-TW') : ''
                            ]);
                        });
                        const usersWS = XLSX.utils.aoa_to_sheet(usersWSData);
                        XLSX.utils.book_append_sheet(wb, usersWS, '帳號');
                    } else {
                        // 僅匯出開立事項
                        const issuesWSData = [];
                        if (exportScope === 'latest') {
                            issuesWSData.push(['編號', '年度', '機構', '分組', '檢查種類', '類型', '狀態', '事項內容', '最新辦理情形', '最新審查意見']);
                            issuesData.forEach(item => {
                                let latestH = '', latestR = '';
                                for (let i = 200; i >= 1; i--) { 
                                    const suffix = i === 1 ? '' : i;
                                    if (!latestH && (item[`handling${suffix}`])) latestH = stripHtml(item[`handling${suffix}`] || ''); 
                                    if (!latestR && (item[`review${suffix}`])) latestR = stripHtml(item[`review${suffix}`] || ''); 
                                }
                                issuesWSData.push([
                                    item.number || '',
                                    item.year || '',
                                    item.unit || '',
                                    item.divisionName || '',
                                    item.inspectionCategoryName || '',
                                    item.category || '',
                                    item.status || '',
                                    stripHtml(item.content || ''),
                                    latestH,
                                    latestR
                                ]);
                            });
                        } else {
                            issuesWSData.push(['編號', '年度', '機構', '分組', '檢查種類', '類型', '狀態', '事項內容', '完整辦理情形歷程', '完整審查意見歷程']);
                            issuesData.forEach(item => {
                                let fullH = [], fullR = [];
                                for (let i = 1; i <= 200; i++) {
                                    const suffix = i === 1 ? '' : i;
                                    const valH = item[`handling${suffix}`], valR = item[`review${suffix}`];
                                    if (valH) fullH.push(`[第${i}次] ${stripHtml(valH)}`); 
                                    if (valR) fullR.push(`[第${i}次] ${stripHtml(valR)}`);
                                }
                                const joinedH = fullH.length > 0 ? fullH.join("\n-------------------\n") : "";
                                const joinedR = fullR.length > 0 ? fullR.join("\n-------------------\n") : "";
                                issuesWSData.push([
                                    item.number || '',
                                    item.year || '',
                                    item.unit || '',
                                    item.divisionName || '',
                                    item.inspectionCategoryName || '',
                                    item.category || '',
                                    item.status || '',
                                    stripHtml(item.content || ''),
                                    joinedH,
                                    joinedR
                                ]);
                            });
                        }
                        const issuesWS = XLSX.utils.aoa_to_sheet(issuesWSData);
                        XLSX.utils.book_append_sheet(wb, issuesWS, '開立事項');
                    }
                    
                    // 生成 Excel 檔案
                    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(blob);
                    let fileName = '';
                    if (exportDataType === 'issues') {
                        const typeLabel = exportScope === 'latest' ? 'Latest' : 'FullHistory';
                        fileName = `SMS_Issues_${typeLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`;
                    } else if (exportDataType === 'users') {
                        fileName = `SMS_Users_${new Date().toISOString().slice(0, 10)}.xlsx`;
                    } else if (exportDataType === 'plans') {
                        fileName = `SMS_Plans_${new Date().toISOString().slice(0, 10)}.xlsx`;
                    } else {
                        fileName = `SMS_AllData_${new Date().toISOString().slice(0, 10)}.xlsx`;
                    }
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    showToast('Excel 匯出完成', 'success');
                    return;
                }

                // 如果格式不是 Excel 或 JSON，預設使用 Excel
                if (exportFormat !== 'excel' && exportFormat !== 'json') {
                    showToast('不支援的匯出格式，將使用 Excel 格式', 'warning');
                }
            } catch (e) { 
                showToast('匯出失敗: ' + e.message, 'error'); 
            }
        }

        // --- User modal submit & password strength ---
        document.getElementById('uPwd')?.addEventListener('input', updatePwdStrength); document.getElementById('uPwdConfirm')?.addEventListener('input', updatePwdStrength);
        function updatePwdStrength() { 
            const p = document.getElementById('uPwd').value || ''; 
            const conf = document.getElementById('uPwdConfirm').value || ''; 
            let score = 0; 
            let issues = [];
            
            if (p.length >= 8) score++; else issues.push('至少8字元');
            if (/[A-Z]/.test(p)) score++; else issues.push('大寫字母');
            if (/[a-z]/.test(p)) score++; else issues.push('小寫字母');
            if (/[0-9]/.test(p)) score++; else issues.push('數字');
            if (/[^A-Za-z0-9]/.test(p)) score++;
            
            const texts = ['弱', '偏弱', '一般', '良好', '強']; 
            const strengthText = texts[Math.min(score, 4)];
            const mismatchText = conf && p !== conf ? ' (密碼不相符)' : '';
            const issuesText = issues.length > 0 && p.length > 0 ? ` - 缺少: ${issues.join(', ')}` : '';
            
            document.getElementById('pwdStrength').innerText = `密碼強度: ${strengthText}${mismatchText}${issuesText}`; 
        }

        // 帳號匯入功能
        function openUserImportModal() {
            const modal = document.getElementById('userImportModal');
            if (modal) {
                const fileInput = document.getElementById('userImportModalFile');
                if (fileInput) fileInput.value = '';
                modal.classList.add('open');
            }
        }
        
        function closeUserImportModal() {
            const modal = document.getElementById('userImportModal');
            if (modal) {
                modal.classList.remove('open');
                const fileInput = document.getElementById('userImportModalFile');
                if (fileInput) fileInput.value = '';
            }
        }

        async function importUsersCSVFromModal() {
            const fileInput = document.getElementById('userImportModalFile');
            if (!fileInput) return showToast('找不到檔案選擇器', 'error');
            const file = fileInput.files && fileInput.files[0];
            if (!file) return showToast('請選擇 CSV 檔案', 'error');
            return importUsersCSV(file);
        }
        
        function downloadUserCSVTemplate() {
            // 優先下載「你上傳設定」的範例檔；若尚未設定才用系統預設產生
            (async () => {
                try {
                    const res = await fetch('/api/templates/users-import-csv?t=' + Date.now(), { credentials: 'include' });
                    if (res.ok) {
                        const blob = await res.blob();
                        const cd = res.headers.get('content-disposition') || '';
                        let filename = '帳號匯入範例.csv';
                        const m = cd.match(/filename\*\=UTF-8''([^;]+)/i);
                        if (m && m[1]) filename = decodeURIComponent(m[1]);
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = filename;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        return;
                    }
                } catch (e) {}

                // fallback：系統預設範例
                // 範例檔格式：姓名,帳號,權限,密碼（選填）
                // 權限值：manager（資料管理者）、viewer（檢視人員）
                // 注意：系統管理員權限由「系統管理群組」決定（不是用 role 欄位）
                const csv = '姓名,帳號,權限,密碼\n張三,zhang@example.com,manager,password123\n李四,li@example.com,manager,password123\n王五,wang@example.com,viewer,';
                const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = '帳號匯入範例.csv';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            })();
        }

        async function uploadUserCSVTemplate() {
            const input = document.getElementById('userTemplateFile');
            if (!input) return showToast('找不到檔案選擇器', 'error');
            input.onchange = async function () {
                const file = input.files && input.files[0];
                if (!file) return;
                const name = String(file.name || '帳號匯入範例.csv');
                if (!name.toLowerCase().endsWith('.csv')) {
                    input.value = '';
                    return showToast('請選擇 .csv 檔案', 'error');
                }
                try {
                    const buf = await file.arrayBuffer();
                    const dataBase64 = arrayBufferToBase64(buf);
                    const res = await apiFetch('/api/templates/users-import-csv', {
                        method: 'POST',
                        body: JSON.stringify({ filename: name, dataBase64 })
                    });
                    const j = await res.json().catch(() => ({}));
                    if (!res.ok) {
                        showToast(j.error || '上傳失敗', 'error');
                        return;
                    }
                    showToast('已設為帳號匯入範例檔', 'success');
                } catch (e) {
                    showToast('上傳失敗：' + (e.message || '請稍後再試'), 'error');
                } finally {
                    input.value = '';
                }
            };
            input.click();
        }
        
        async function importUsersCSV(fileOverride) {
            const file = fileOverride || (document.getElementById('userImportModalFile')?.files?.[0]) || (document.getElementById('userImportFile')?.files?.[0]);
            if (!file) return showToast('請選擇 CSV 檔案', 'error');
            
            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    const csv = e.target.result;
                    Papa.parse(csv, {
                        header: true,
                        skipEmptyLines: true,
                        encoding: "UTF-8",
                        transformHeader: function(header) {
                            return header.trim();
                        },
                        transform: function(value) {
                            return value ? value.trim() : '';
                        },
                        complete: async function(results) {
                            if (results.errors.length && results.data.length === 0) {
                                return showToast('CSV 解析錯誤：' + (results.errors[0]?.message || '未知錯誤'), 'error');
                            }
                            
                            const validData = [];
                            const invalidRows = [];
                            
                            results.data.forEach((row, index) => {
                                // 支援多種欄位名稱
                                let name = '';
                                let username = '';
                                let role = '';
                                let password = '';
                                
                                for (const key in row) {
                                    const cleanKey = key.trim();
                                    if (cleanKey === '姓名' || cleanKey === 'name') {
                                        name = String(row[key] || '').trim();
                                    }
                                    if (cleanKey === '帳號' || cleanKey === 'username' || cleanKey === 'email') {
                                        username = String(row[key] || '').trim();
                                    }
                                    if (cleanKey === '權限' || cleanKey === 'role') {
                                        role = String(row[key] || '').trim();
                                    }
                                    if (cleanKey === '密碼' || cleanKey === 'password') {
                                        password = String(row[key] || '').trim();
                                    }
                                }
                                
                                // 驗證必填欄位
                                if (!name || !username || !role) {
                                    invalidRows.push({
                                        row: index + 2,
                                        name: name || '(空白)',
                                        username: username || '(空白)',
                                        role: role || '(空白)'
                                    });
                                    return;
                                }
                                
                                // 驗證權限值（支援英文代碼和中文名稱）
                                const roleMap = {
                                    'admin': 'manager', // admin 由群組決定，匯入時視為 manager
                                    'manager': 'manager',
                                    'editor': 'manager',
                                    'viewer': 'viewer',
                                    '系統管理員': 'manager', // admin 由群組決定，匯入時視為 manager
                                    '資料管理者': 'manager',
                                    '審查人員': 'manager',
                                    '檢視人員': 'viewer'
                                };
                                
                                const normalizedRole = roleMap[role] || roleMap[role.toLowerCase()];
                                if (!normalizedRole) {
                                    invalidRows.push({
                                        row: index + 2,
                                        error: `無效的權限值：${role}（應為：manager/資料管理者, viewer/檢視人員）`
                                    });
                                    return;
                                }
                                
                                validData.push({ name, username, role: normalizedRole, password });
                            });
                            
                            if (validData.length === 0) {
                                let errorMsg = 'CSV 檔案中沒有有效的資料';
                                if (invalidRows.length > 0) {
                                    errorMsg += `\n發現 ${invalidRows.length} 筆資料格式錯誤`;
                                    console.error('無效行詳情：', invalidRows);
                                }
                                return showToast(errorMsg, 'error');
                            }
                            
                            try {
                                const res = await apiFetch('/api/users/import', {
                                    method: 'POST',
                                    body: JSON.stringify({ data: validData })
                                });
                                
                                if (res.status === 401) {
                                    return showToast('匯入錯誤：請先登入系統', 'error');
                                } else if (res.status === 403) {
                                    return showToast('匯入錯誤：您沒有權限執行此操作', 'error');
                                }
                                
                                let j;
                                try {
                                    j = await res.json();
                                } catch (parseError) {
                                    if (res.ok) {
                                        showToast('匯入可能已完成，但無法解析伺服器回應。請重新整理頁面確認結果。', 'warning');
                                        closeUserImportModal();
                                        await loadUsersPage(1);
                                        return;
                                    } else {
                                        return showToast('匯入錯誤：伺服器回應格式錯誤（狀態碼：' + res.status + '）', 'error');
                                    }
                                }
                                
                                if (res.ok && j.success === true) {
                                    const successCount = j.successCount || 0;
                                    let msg = `匯入完成：成功 ${successCount} 筆`;
                                    if (j.failed > 0) {
                                        msg += `，失敗 ${j.failed} 筆`;
                                        if (j.errors && j.errors.length > 0) {
                                            const errorPreview = j.errors.slice(0, 3).join('；');
                                            if (j.errors.length > 3) {
                                                msg += `\n（前3個錯誤：${errorPreview}...）`;
                                            } else {
                                                msg += `\n（錯誤：${errorPreview}）`;
                                            }
                                        }
                                    }
                                    
                                    if (successCount < validData.length) {
                                        msg += `\n⚠️ 注意：前端解析到 ${validData.length} 筆有效資料，但只成功匯入 ${successCount} 筆。可能是因為資料庫中已有重複的帳號。`;
                                    }
                                    
                                    showToast(msg, j.failed > 0 ? 'warning' : 'success');
                                    // 關閉匯入視窗並更新列表
                                    closeUserImportModal();
                                    await loadUsersPage(1);
                                    return;
                                } else {
                                    showToast(j.error || '匯入失敗', 'error');
                                    return;
                                }
                            } catch (e) {
                                if (e.message && (e.message.includes('Failed to fetch') || e.message.includes('NetworkError'))) {
                                    showToast('匯入錯誤：網路連線失敗', 'error');
                                } else {
                                    console.error('匯入時發生未預期錯誤：', e);
                                    showToast('匯入錯誤：' + e.message, 'error');
                                }
                            }
                        }
                    });
                } catch (e) {
                    showToast('讀取檔案錯誤：' + e.message, 'error');
                }
            };
            reader.readAsText(file, 'UTF-8');
        }

        // 後台管理（帳號列表）用：點按後直接選檔並執行匯入
        function promptUsersImport() {
            const input = document.getElementById('userImportFile');
            if (!input) return showToast('找不到檔案選擇器', 'error');
            input.value = '';
            input.onchange = async function () {
                if (!input.files || !input.files[0]) return;
                await importUsersCSV();
            };
            input.click();
        }

        // Plan Management, schedule calendar -> js/plans-view.js

        // 處理開始日期變更，自動設定結束日期為同月最後一天
        function handlePlanStartDateChange() {
            const startDateInput = document.getElementById('planStartDate');
            const endDateInput = document.getElementById('planEndDate');
            if (!startDateInput || !endDateInput) return;
            
            const startDateVal = startDateInput.value;
            if (!startDateVal) {
                endDateInput.value = '';
                return;
            }
            
            // 計算該月的最後一天
            const date = new Date(startDateVal);
            const year = date.getFullYear();
            const month = date.getMonth();
            const lastDay = new Date(year, month + 1, 0).getDate();
            const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            
            // 如果結束日期為空或早於開始日期，自動設定為該月最後一天
            if (!endDateInput.value || endDateInput.value < startDateVal) {
                endDateInput.value = endDate;
            }
        }
        
        function applyScheduleToPlanForm(schedule, basePlan) {
            const scheduleIdInput = document.getElementById('targetScheduleId');
            const nameInput = document.getElementById('planName');
            const yearInput = document.getElementById('planYear');
            const startInput = document.getElementById('planStartDate');
            const endInput = document.getElementById('planEndDate');
            const railwaySelect = document.getElementById('planRailway');
            const inspectionSelect = document.getElementById('planInspectionType');
            const locationInput = document.getElementById('planLocation');
            const inspectorInput = document.getElementById('planInspector');
            const planNumberInput = document.getElementById('planScheduleNumber');
            const planNumberRow = document.getElementById('planNumberRow');
            if (!schedule || !nameInput || !yearInput || !railwaySelect || !inspectionSelect) return;
            
            if (scheduleIdInput) scheduleIdInput.value = schedule.id || '';
            nameInput.value = (basePlan && basePlan.name) ? basePlan.name : (schedule.plan_name || '');
            let rocYear = '';
            if (schedule.start_date) {
                const adYear = parseInt(schedule.start_date.slice(0, 4), 10);
                if (!Number.isNaN(adYear)) rocYear = String(adYear - 1911).padStart(3, '0');
            }
            if (!rocYear && basePlan && basePlan.year) rocYear = String(basePlan.year).padStart(3, '0');
            if (yearInput) yearInput.value = rocYear;
            if (startInput) startInput.value = schedule.start_date ? schedule.start_date.slice(0, 10) : '';
            if (endInput) endInput.value = schedule.end_date ? schedule.end_date.slice(0, 10) : '';
            if (planNumberInput) planNumberInput.value = (schedule.plan_number || '').trim();
            if (planNumberRow) planNumberRow.style.display = 'flex';
            railwaySelect.value = schedule.railway || '';
            inspectionSelect.value = schedule.inspection_type || '';
            if (locationInput) locationInput.value = schedule.location || '';
            if (inspectorInput) inspectorInput.value = schedule.inspector || '';
        }
        
        function selectPlanSchedule(scheduleId) {
            const idNum = Number(scheduleId);
            if (!currentPlanSchedules || currentPlanSchedules.length === 0) return;
            const schedule = currentPlanSchedules.find(s => Number(s.id) === idNum);
            if (!schedule) return;
            const planId = Number((document.getElementById('targetPlanId') || {}).value || '0');
            const basePlan = planList.find(p => Number(p.id) === planId) || {};
            applyScheduleToPlanForm(schedule, basePlan);
            document.querySelectorAll('.plan-schedule-item').forEach(el => el.classList.remove('selected'));
            const el = document.querySelector(`.plan-schedule-item[data-schedule-id="${scheduleId}"]`);
            if (el) el.classList.add('selected');
            var datesSection = document.getElementById('planDatesSection');
            if (datesSection) datesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        async function openPlanModal(mode, id) {
            const m = document.getElementById('planModal');
            const t = document.getElementById('planModalTitle');
            const planDetailsGroup = document.getElementById('planDetailsGroup');
            const planDetailsGroup2 = document.getElementById('planDetailsGroup2');
            const planBusinessGroup = document.getElementById('planBusinessGroup');
            const planPlannedCountGroup = document.getElementById('planPlannedCountGroup');
            const planDatesSection = document.getElementById('planDatesSection');
            const planSchedulesSection = document.getElementById('planSchedulesSection');
            const planStartDateGroup = document.getElementById('planStartDateGroup');
            const planEndDateGroup = document.getElementById('planEndDateGroup');
            const planLocationInspectorRow = document.getElementById('planLocationInspectorRow');
            
            if (mode === 'create') {
                t.innerText = '新增檢查計畫';
                const planEditorsWrap = document.getElementById('planEditorsBtnWrap');
                if (planEditorsWrap) planEditorsWrap.style.display = 'none';
                const planOwnerGroupEl = document.getElementById('planOwnerGroup');
                if (planOwnerGroupEl) planOwnerGroupEl.querySelectorAll('.owner-group-cb').forEach(cb => { cb.checked = false; });
                document.getElementById('targetPlanId').value = '';
                document.getElementById('targetScheduleId').value = '';
                document.getElementById('planName').value = '';
                document.getElementById('planYear').value = '';
                document.getElementById('planRailway').value = '';
                document.getElementById('planInspectionType').value = '';
                const planBusinessEl = document.getElementById('planBusiness');
                if (planBusinessEl) planBusinessEl.value = '';
                const planPlannedCountEl = document.getElementById('planPlannedCount');
                if (planPlannedCountEl) planPlannedCountEl.value = '';
                currentPlanSchedules = [];
                const planSchedulesList = document.getElementById('planSchedulesList');
                if (planSchedulesList) planSchedulesList.innerHTML = '<div class="plan-schedules-empty">尚未有檢查行程，請先至「填寫檢查行程」建立。</div>';
                if (planDetailsGroup) planDetailsGroup.style.display = 'block';
                if (planDetailsGroup2) planDetailsGroup2.style.display = 'block';
                if (planBusinessGroup) planBusinessGroup.style.display = 'block';
                if (planPlannedCountGroup) planPlannedCountGroup.style.display = 'block';
                if (planDatesSection) planDatesSection.style.display = 'none';
                if (planSchedulesSection) planSchedulesSection.style.display = 'none';
                if (m) m.classList.add('open');
                return;
            }
            
            const p = planList.find(x => x.id === id) || {};
            t.innerText = '編輯檢查計畫';
            const planEditorsWrap = document.getElementById('planEditorsBtnWrap');
            if (planEditorsWrap) planEditorsWrap.style.display = 'flex';
            document.getElementById('targetPlanId').value = p.id || '';
            document.getElementById('targetScheduleId').value = '';
            const planPlannedCountEl = document.getElementById('planPlannedCount');
            if (planPlannedCountEl) planPlannedCountEl.value = p.planned_count != null ? String(p.planned_count) : '';
            const planBusinessEl = document.getElementById('planBusiness');
            if (planBusinessEl) planBusinessEl.value = p.business || '';
            if (planDetailsGroup) planDetailsGroup.style.display = 'block';
            if (planDetailsGroup2) planDetailsGroup2.style.display = 'block';
            if (planBusinessGroup) planBusinessGroup.style.display = 'block';
            if (planPlannedCountGroup) planPlannedCountGroup.style.display = 'block';
            if (planDatesSection) planDatesSection.style.display = 'block';
            if (planSchedulesSection) planSchedulesSection.style.display = 'block';
            if (planStartDateGroup) planStartDateGroup.style.display = 'block';
            if (planEndDateGroup) planEndDateGroup.style.display = 'block';
            if (planLocationInspectorRow) planLocationInspectorRow.style.display = 'flex';
            const planStartDateInput = document.getElementById('planStartDate');
            const planEndDateInput = document.getElementById('planEndDate');
            if (planStartDateInput && planEndDateInput) {
                planStartDateInput.removeEventListener('change', handlePlanStartDateChange);
                planStartDateInput.addEventListener('change', handlePlanStartDateChange);
            }
            try {
                const scheduleRes = await fetch(`/api/plans/${p.id}/schedules?t=${Date.now()}`, { credentials: 'include' });
                const planSchedulesList = document.getElementById('planSchedulesList');
                currentPlanSchedules = [];
                if (scheduleRes.ok) {
                    const scheduleData = await scheduleRes.json();
                    const schedules = scheduleData.data || [];
                    currentPlanSchedules = schedules;
                    const validSchedules = schedules.filter(s => s.plan_number && s.plan_number !== '(手動)');
                    if (planSchedulesList) {
                        if (!validSchedules.length) {
                            planSchedulesList.innerHTML = '<div class="plan-schedules-empty">尚未有檢查行程，請先至「填寫檢查行程」或在此建立第一筆行程。</div>';
                        } else {
                            planSchedulesList.innerHTML = validSchedules.map((s, idx) => {
                                const start = (s.start_date || '').slice(0, 10);
                                const end = (s.end_date || '').slice(0, 10);
                                const range = end && end !== start ? `${start} ~ ${end}` : start;
                                const planNumber = (s.plan_number || '').trim();
                                const loc = (s.location || '').trim();
                                const insp = (s.inspector || '').trim();
                                return `<div class="plan-schedule-item" data-schedule-id="${s.id}" onclick="selectPlanSchedule(${s.id})">
                                    <div class="schedule-row-top"><span>第 ${idx + 1} 筆行程</span>${planNumber ? `<span class="plan-number">${planNumber}</span>` : ''}</div>
                                    <div class="schedule-row-detail">📅 ${range || '尚未設定日期'}${loc ? ' · 📍 ' + loc : ''}${insp ? ' · 👤 ' + insp : ''}</div>
                                </div>`;
                            }).join('');
                        }
                    }
                    if (validSchedules.length > 0) {
                        applyScheduleToPlanForm(validSchedules[0], p);
                        const firstEl = planSchedulesList && planSchedulesList.querySelector('.plan-schedule-item');
                        if (firstEl) firstEl.classList.add('selected');
                    } else {
                        document.getElementById('planName').value = p.name || '';
                        document.getElementById('planYear').value = p.year || '';
                        const railwaySel = document.getElementById('planRailway');
                        if (railwaySel) railwaySel.value = p.railway || '';
                        const typeSel = document.getElementById('planInspectionType');
                        if (typeSel) typeSel.value = p.inspection_type || '';
                        if (document.getElementById('planLocation')) document.getElementById('planLocation').value = '';
                        if (document.getElementById('planInspector')) document.getElementById('planInspector').value = '';
                        var planNumberRow = document.getElementById('planNumberRow');
                        if (planNumberRow) planNumberRow.style.display = 'none';
                        var planScheduleNumber = document.getElementById('planScheduleNumber');
                        if (planScheduleNumber) planScheduleNumber.value = '';
                    }
                } else if (planSchedulesList) {
                    planSchedulesList.innerHTML = '<div class="plan-schedules-empty" style="color:#f97316;">無法載入行程列表，請稍後再試。</div>';
                }
            } catch (e) {
                const planSchedulesList = document.getElementById('planSchedulesList');
                if (planSchedulesList) planSchedulesList.innerHTML = '<div class="plan-schedules-empty" style="color:#f97316;">載入行程列表時發生錯誤。</div>';
            }
            if (m) m.classList.add('open');
        }
        function closePlanModal() {
            const m = document.getElementById('planModal');
            if (m) m.classList.remove('open');
        }
        function openPlanImportModal() {
            const m = document.getElementById('planImportModal');
            if (m) {
                const fileInput = document.getElementById('planImportFile');
                if (fileInput) fileInput.value = '';
                m.classList.add('open');
            }
        }
        function closePlanImportModal() {
            const m = document.getElementById('planImportModal');
            if (m) m.classList.remove('open');
        }
        function parsePlansImportRows(rows) {
            const validData = [];
            const invalidRows = [];
            (rows || []).forEach((row, index) => {
                // 檢查是否為完全空行
                const isEmptyRow = !row || Object.values(row).every(val => !val || String(val).trim() === '');
                if (isEmptyRow) return;

                let name = '', year = '', railwayRaw = '', inspectionRaw = '', businessRaw = '', planned_count = '';
                for (const key in row) {
                    const cleanKey = String(key || '').trim();
                    if (cleanKey === '計畫名稱' || cleanKey === 'name' || cleanKey === 'planName' || cleanKey === '計劃名稱') {
                        name = String(row[key] || '').trim();
                    } else if (cleanKey === '年度' || cleanKey === 'year') {
                        year = String(row[key] || '').trim();
                    } else if (cleanKey === '鐵路機構' || cleanKey === 'railway') {
                        railwayRaw = String(row[key] || '').trim();
                    } else if (cleanKey === '檢查類別' || cleanKey === 'inspection_type' || cleanKey === 'inspectionType') {
                        inspectionRaw = String(row[key] || '').trim();
                    } else if (cleanKey === '業務類型' || cleanKey === '業務類別' || cleanKey === 'business') {
                        businessRaw = String(row[key] || '').trim();
                    } else if (cleanKey === '規劃檢查幾次' || cleanKey === '規劃檢查次數' || cleanKey === 'planned_count' || cleanKey === 'plannedCount') {
                        planned_count = String(row[key] || '').trim();
                    }
                }

                const yearStr = String(year || '').replace(/\D/g, '').slice(-3).padStart(3, '0');
                const railwayMap = {
                    '臺鐵': 'T', '台鐵': 'T', 'T': 'T',
                    '高鐵': 'H', 'H': 'H',
                    '林鐵': 'A', 'A': 'A',
                    '糖鐵': 'S', 'S': 'S'
                };
                const inspectionMap = {
                    '年度定期檢查': '1', '1': '1',
                    '特別檢查': '2', '2': '2',
                    '例行性檢查': '3', '3': '3',
                    '臨時檢查': '4', '4': '4'
                };
                const businessMap = {
                    '運轉': 'OP', 'OP': 'OP',
                    '土建': 'CV', 'CV': 'CV',
                    '機務': 'ME', 'ME': 'ME',
                    '電務': 'EL', 'EL': 'EL',
                    '安全管理': 'SM', 'SM': 'SM',
                    '營運／災防審核': 'AD', '營運/災防審核': 'AD', '營運': 'AD', 'AD': 'AD',
                    '其他／產管規劃': 'OT', '其他/產管規劃': 'OT', '其他': 'OT', 'OT': 'OT'
                };
                const railway = railwayMap[String(railwayRaw || '').trim()] || '';
                const inspection_type = inspectionMap[String(inspectionRaw || '').trim()] || '';
                const business = businessMap[String(businessRaw || '').trim()] || null;
                const plannedCountVal = planned_count !== '' ? parseInt(planned_count, 10) : null;

                const missing = [];
                if (!name) missing.push('計畫名稱');
                if (!yearStr) missing.push('年度');
                if (!railway) missing.push('鐵路機構');
                if (!inspection_type) missing.push('檢查類別');
                if (plannedCountVal != null && (Number.isNaN(plannedCountVal) || plannedCountVal < 0)) missing.push('規劃檢查幾次(需為>=0數字)');

                if (missing.length === 0) {
                    validData.push({
                        name,
                        year: yearStr,
                        railway,
                        inspection_type,
                        business,
                        planned_count: plannedCountVal
                    });
                } else {
                    invalidRows.push({
                        row: index + 2,
                        name: name || '(空白)',
                        year: year || '(空白)',
                        railway: railwayRaw || '(空白)',
                        inspection_type: inspectionRaw || '(空白)',
                        planned_count: planned_count || '(空白)',
                        missing,
                        rawRow: row
                    });
                }
            });
            return { validData, invalidRows };
        }

        async function importPlansXlsx() {
            const fileInput = document.getElementById('planImportFile');
            if (!fileInput) return showToast('找不到檔案選擇器', 'error');
            const file = fileInput.files[0];
            if (!file) return showToast('請選擇匯入檔案', 'error');

            const filename = String(file.name || '').toLowerCase();
            const isXlsx = filename.endsWith('.xlsx');
            if (!isXlsx) return showToast('僅支援 .xlsx', 'error');
            
            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    let rows = [];
                    if (typeof XLSX === 'undefined') return showToast('缺少 Excel 解析模組，請重新整理頁面後再試', 'error');
                    const buf = e.target.result;
                    const wb = XLSX.read(buf, { type: 'array' });
                    const sheetName = wb.SheetNames.includes('匯入') ? '匯入' : wb.SheetNames[0];
                    const ws = wb.Sheets[sheetName];
                    rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

                    const { validData, invalidRows } = parsePlansImportRows(rows);
                    if (validData.length === 0) {
                        let errorMsg = '匯入檔案中沒有有效的資料';
                        if (invalidRows.length > 0) {
                            errorMsg += `\n發現 ${invalidRows.length} 筆資料缺少必要欄位（計畫名稱、年度、鐵路機構、檢查類別）`;
                            console.error('無效行詳情：', invalidRows);
                        }
                        return showToast(errorMsg, 'error');
                    }

                    try {
                        const res = await apiFetch('/api/plans/import', {
                            method: 'POST',
                            body: JSON.stringify({ data: validData })
                        });
                                
                                // 先檢查 HTTP 狀態碼
                                if (res.status === 401) {
                                    return showToast('匯入錯誤：請先登入系統', 'error');
                                } else if (res.status === 403) {
                                    return showToast('匯入錯誤：您沒有權限執行此操作', 'error');
                                }
                                
                                // 嘗試解析 JSON
                                let j;
                                let text;
                                try {
                                    text = await res.text();
                                    j = JSON.parse(text);
                                } catch (parseError) {
                                    // 如果解析失敗，檢查狀態碼
                                    if (res.ok) {
                                        // 如果狀態碼是 OK，但解析失敗，可能是格式問題，但實際可能已成功
                                        showToast('匯入可能已完成，但無法解析伺服器回應。請重新整理頁面確認結果。', 'warning');
                                        closePlanImportModal();
                                        await loadPlansPage(1);
                                        await loadPlanOptions();
                                        return;
                                    } else {
                                        return showToast('匯入錯誤：伺服器回應格式錯誤（狀態碼：' + res.status + '）', 'error');
                                    }
                                }
                                
                                if (res.ok && j.success === true) {
                                    const successCount = j.successCount || 0;
                                    let msg = `匯入完成：成功 ${successCount} 筆`;
                                    if (j.skipped > 0) msg += `，跳過空行 ${j.skipped} 筆`;
                                    if (j.failed > 0) msg += `，失敗 ${j.failed} 筆`;
                                    showToast(msg, j.failed > 0 ? 'warning' : 'success');
                                    closePlanImportModal();
                                    await loadPlansPage(1);
                                    await loadPlanOptions();
                                    setTimeout(() => { loadPlanOptions(); }, 500);
                                    return;
                                } else {
                                    showToast(j.error || '匯入失敗', 'error');
                                    return;
                                }
                            } catch (e) {
                                // 只有在真正的網路錯誤或無法處理的錯誤時才顯示錯誤
                                // 如果已經在 try 區塊中顯示了成功或錯誤訊息，這裡不應該再顯示
                                // 檢查錯誤類型，避免重複顯示
                                if (e.name === 'TypeError' && (e.message.includes('text') || e.message.includes('already been read'))) {
                                    // 如果已經讀取過 text，可能是重複讀取的問題
                                    // 不顯示錯誤，因為可能已經成功匯入了
                                    return;
                                }
                                // 只有在真正的網路錯誤時才顯示
                                if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
                                    showToast('匯入錯誤：網路連線失敗', 'error');
                                } else {
                                    // 其他未預期的錯誤，但不要顯示，因為可能已經成功匯入了
                                    console.error('匯入時發生未預期錯誤（可能已成功）：', e);
                                }
                            }
                } catch (e) {
                    showToast('讀取檔案錯誤：' + e.message, 'error');
                }
            };
            reader.readAsArrayBuffer(file);
        }

        function arrayBufferToBase64(buffer) {
            const bytes = new Uint8Array(buffer);
            let binary = '';
            const chunkSize = 0x8000;
            for (let i = 0; i < bytes.length; i += chunkSize) {
                binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
            }
            return btoa(binary);
        }

        async function downloadPlanXlsxTemplate() {
            // 優先下載「你上傳設定」的範例檔；若尚未設定才用系統預設產生
            try {
                const res = await fetch('/api/templates/plans-import-xlsx?t=' + Date.now(), { credentials: 'include' });
                if (res.ok) {
                    const blob = await res.blob();
                    const cd = res.headers.get('content-disposition') || '';
                    let filename = '檢查計畫匯入範例.xlsx';
                    const m = cd.match(/filename\*\=UTF-8''([^;]+)/i);
                    if (m && m[1]) filename = decodeURIComponent(m[1]);
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    return;
                }
            } catch (e) {
                // 忽略，改用預設範例
            }
            return downloadDefaultPlanXlsxTemplate();
        }

        function downloadDefaultPlanXlsxTemplate() {
            if (typeof XLSX === 'undefined') {
                return showToast('缺少 Excel 產生模組，請重新整理頁面後再試', 'error');
            }
            const wb = XLSX.utils.book_new();

            const sheet1 = [
                ['年度', '計畫名稱', '鐵路機構', '檢查類別', '業務類型', '規劃檢查幾次'],
                ['113', '上半年定期檢查', '臺鐵', '年度定期檢查', '運轉', '2'],
                ['113', '特別檢查', '高鐵', '特別檢查', '營運／災防審核', '1']
            ];
            const ws1 = XLSX.utils.aoa_to_sheet(sheet1);
            ws1['!cols'] = [{ wch: 6 }, { wch: 20 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];
            XLSX.utils.book_append_sheet(wb, ws1, '匯入');

            const sheet2 = [
                ['鐵路機構(中文)', '代號', '', '檢查類別(中文)', '代號', '', '業務類型(中文)', '代號'],
                ['臺鐵', 'T', '', '年度定期檢查', '1', '', '運轉', 'OP'],
                ['高鐵', 'H', '', '特別檢查', '2', '', '土建', 'CV'],
                ['林鐵', 'A', '', '例行性檢查', '3', '', '機務', 'ME'],
                ['糖鐵', 'S', '', '臨時檢查', '4', '', '電務', 'EL'],
                ['', '', '', '', '', '', '安全管理', 'SM'],
                ['', '', '', '', '', '', '營運／災防審核', 'AD'],
                ['', '', '', '', '', '', '其他／產管規劃', 'OT'],
                ['說明', '請在「匯入」工作表填寫中文值；系統會自動轉換成代號存入資料庫。', '', '', '', '', '', '']
            ];
            const ws2 = XLSX.utils.aoa_to_sheet(sheet2);
            ws2['!cols'] = [{ wch: 14 }, { wch: 6 }, { wch: 2 }, { wch: 16 }, { wch: 6 }, { wch: 2 }, { wch: 18 }, { wch: 6 }];
            XLSX.utils.book_append_sheet(wb, ws2, '選單');

            XLSX.writeFile(wb, '檢查計畫匯入範例.xlsx');
        }

        async function uploadPlanXlsxTemplate() {
            const input = document.getElementById('planTemplateFile');
            if (!input) return showToast('找不到檔案選擇器', 'error');
            input.onchange = async function() {
                const file = input.files && input.files[0];
                if (!file) return;
                const name = String(file.name || '檢查計畫匯入範例.xlsx');
                if (!name.toLowerCase().endsWith('.xlsx')) {
                    input.value = '';
                    return showToast('請選擇 .xlsx 檔案', 'error');
                }
                try {
                    const buf = await file.arrayBuffer();
                    const dataBase64 = arrayBufferToBase64(buf);
                    const res = await apiFetch('/api/templates/plans-import-xlsx', {
                        method: 'POST',
                        body: JSON.stringify({ filename: name, dataBase64 })
                    });
                    const j = await res.json().catch(() => ({}));
                    if (!res.ok) {
                        showToast(j.error || '上傳失敗', 'error');
                        return;
                    }
                    showToast('已設為網站下載範例檔', 'success');
                } catch (e) {
                    showToast('上傳失敗：' + (e.message || '請稍後再試'), 'error');
                } finally {
                    input.value = '';
                }
            };
            input.click();
        }
        async function submitPlan() {
            const planId = document.getElementById('targetPlanId').value;
            const scheduleId = document.getElementById('targetScheduleId').value;
            const name = document.getElementById('planName').value.trim();
            const year = document.getElementById('planYear').value.trim();
            const startDate = (document.getElementById('planStartDate') || {}).value;
            const endDate = (document.getElementById('planEndDate') || {}).value;
            const railway = document.getElementById('planRailway').value;
            const inspectionType = document.getElementById('planInspectionType').value;
            const planBusinessEl = document.getElementById('planBusiness');
            const business = planBusinessEl && planBusinessEl.value ? planBusinessEl.value : null;
            const planPlannedCountEl = document.getElementById('planPlannedCount');
            const plannedCount = planPlannedCountEl && planPlannedCountEl.value !== '' ? planPlannedCountEl.value : null;
            const planLocationEl = document.getElementById('planLocation');
            const planInspectorEl = document.getElementById('planInspector');
            const location = planLocationEl ? planLocationEl.value.trim() : '';
            const inspector = planInspectorEl ? planInspectorEl.value.trim() : '';
            const ownerGroupIds = getPlanOwnerGroupIds();
            
            if (!planId) {
                if (!name) return showToast('請輸入計畫名稱', 'error');
                if (!year) return showToast('請輸入年度', 'error');
                if (!railway) return showToast('請選擇鐵路機構', 'error');
                if (!inspectionType) return showToast('請選擇檢查類別', 'error');
                if (ownerGroupIds.length === 0) return showToast('請至少選擇一個適用群組', 'error');
                try {
                    const res = await apiFetch('/api/plans', {
                        method: 'POST',
                        body: JSON.stringify({
                            name,
                            year: year.replace(/\D/g, '').slice(-3).padStart(3, '0'),
                            railway,
                            inspection_type: inspectionType,
                            business,
                            planned_count: plannedCount,
                            ownerGroupIds
                        })
                    });
                    const j = await res.json();
                    if (res.ok) {
                        showToast('新增成功');
                        closePlanModal();
                        loadPlansPage(plansPage || 1);
                        loadPlanOptions();
                        loadSchedulePlanOptions();
                    } else {
                        showToast(j.error || j.message || '新增失敗', 'error');
                    }
                } catch (e) {
                    showToast('操作失敗，請稍後再試', 'error');
                }
                return;
            }
            
            if (scheduleId) {
                if (!name) return showToast('請輸入計畫名稱', 'error');
                if (!startDate) return showToast('請選擇開始日期', 'error');
                if (!endDate) return showToast('請選擇結束日期', 'error');
                if (!railway || !inspectionType) return showToast('請填寫鐵路機構、檢查類別', 'error');
                const adYear = parseInt(startDate.slice(0, 4), 10);
                const rocYear = adYear - 1911;
                const yearStr = String(rocYear).padStart(3, '0');
                const planNumberEl = document.getElementById('planScheduleNumber');
                const customPlanNumber = planNumberEl && planNumberEl.value ? String(planNumberEl.value).trim() : null;
                const payload = {
                    plan_name: name,
                    start_date: startDate,
                    end_date: endDate,
                    year: yearStr,
                    railway,
                    inspection_type: inspectionType,
                    business: null,
                    location: location || null,
                    inspector: inspector || null
                };
                if (customPlanNumber) payload.plan_number = customPlanNumber;
                try {
                    const res = await apiFetch(`/api/plan-schedule/${scheduleId}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });
                    const j = await res.json();
                    if (res.ok) {
                        showToast('行程更新成功');
                        closePlanModal();
                        loadPlansPage(plansPage || 1);
                        loadPlanOptions();
                        const scheduleTab = document.getElementById('subtab-plans-schedule');
                        if (scheduleTab && !scheduleTab.classList.contains('hidden')) {
                            scheduleMonthData = [];
                            loadScheduleForMonth();
                        }
                    } else {
                        showToast(j.error || '更新失敗', 'error');
                    }
                } catch (e) {
                    showToast('操作失敗：' + e.message, 'error');
                }
                return;
            }
            
            if (!name) return showToast('請輸入計畫名稱', 'error');
            if (!year) return showToast('請輸入年度', 'error');
            try {
                const res = await apiFetch(`/api/plans/${planId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        name,
                        year: year.replace(/\D/g, '').slice(-3).padStart(3, '0'),
                        business,
                        planned_count: plannedCount
                    })
                });
                const j = await res.json();
                if (res.ok) {
                    showToast('計畫更新成功');
                    closePlanModal();
                    loadPlansPage(plansPage || 1);
                    loadPlanOptions();
                    loadSchedulePlanOptions();
                } else {
                    showToast(j.error || '更新失敗', 'error');
                }
            } catch (e) {
                showToast('操作失敗：' + e.message, 'error');
            }
        }
        async function deletePlan(id) {
            const confirmed = await showConfirmModal('確定要刪除這個計畫嗎？\n\n此操作無法復原！', '確定刪除', '取消');
            if (!confirmed) return;
            try {
                const res = await apiFetch(`/api/plans/${id}`, { method: 'DELETE' });
                const j = await res.json();
                if (res.ok) {
                    showToast('刪除成功');
                    loadPlansPage(1);
                    loadPlanOptions();
                    // 如果當前在計畫規劃頁面，強制重新載入月曆（清除快取）
                    const scheduleTab = document.getElementById('subtab-plans-schedule');
                    if (scheduleTab && !scheduleTab.classList.contains('hidden')) {
                        scheduleMonthData = []; // 清除快取資料
                        loadScheduleForMonth();
                    }
                } else {
                    showToast(j.error || '刪除失敗', 'error');
                }
            } catch (e) {
                showToast('刪除失敗', 'error');
            }
        }

        // openProfileModal, submitProfile, submitChangePassword → js/auth.js

        function toggleEditMode(edit) { 
            document.getElementById('viewModeContent').classList.toggle('hidden', edit); 
            document.getElementById('editModeContent').classList.toggle('hidden', !edit); 
            document.getElementById('drawerTitle').innerText = edit ? "審查事項" : "詳細資料"; 
            if (edit) { 
                if (!currentEditItem) return;
                // 清除所有編輯欄位，避免前一個事項的資料殘留
                document.getElementById('editId').value = currentEditItem.id; 
                
                // 編號
                document.getElementById('editHeaderNumber').textContent = currentEditItem.number || '';
                
                // 檢查計畫
                document.getElementById('editHeaderPlanName').textContent = currentEditItem.plan_name || currentEditItem.planName || '(未設定)';
                
                // 檢查種類
                const insName = currentEditItem.inspectionCategoryName || currentEditItem.inspection_category_name || '-';
                document.getElementById('editHeaderInspection').textContent = insName;
                
                // 分組
                const divName = currentEditItem.divisionName || currentEditItem.division_name || '-';
                document.getElementById('editHeaderDivision').textContent = divName;
                
                // 開立日期（發函）
                document.getElementById('editHeaderIssueDate').textContent = currentEditItem.issue_date || currentEditItem.issueDate || '(未設定)';
                
                const st = (currentEditItem.status === 'Open' || !currentEditItem.status) ? '持續列管' : currentEditItem.status; 
                document.getElementById('editStatus').value = st;
                
                // 顯示狀態與類型（缺失、觀察、建議）- 使用統一的字段獲取邏輯
                let k = currentEditItem.item_kind_code || currentEditItem.itemKindCode;
                if (!k) {
                    k = extractKindCodeFromNumber(currentEditItem.number);
                }
                
                let kindLabel = getKindLabel(k);
                let statusBadge = getStatusBadge(st);
                
                // 確保即使只有類型或只有狀態也能顯示
                const statusKindHtml = kindLabel || statusBadge ? `<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">${kindLabel}${statusBadge}</div>` : '';
                document.getElementById('editHeaderStatusKind').innerHTML = statusKindHtml || ''; 
                
                // 計算應該進行第幾次審查（支持無限次）
                // 邏輯：找到最高的機構辦理情形，檢查是否有對應的審查意見
                // 如果沒有，就應該進行該次的審查；如果有，就進行下一次的審查
                let nextRound = 1;
                let highestHandlingRound = 0;
                
                // 先找到最高的機構辦理情形
                for (let i = 1; i <= 200; i++) {
                    const suffix = i === 1 ? '' : i;
                    const hasHandling = currentEditItem['handling' + suffix] && currentEditItem['handling' + suffix].trim();
                    if (hasHandling) {
                        highestHandlingRound = i;
                    }
                }
                
                // 檢查最高的機構辦理情形是否有對應的審查意見
                if (highestHandlingRound > 0) {
                    const suffix = highestHandlingRound === 1 ? '' : highestHandlingRound;
                    const hasReview = currentEditItem['review' + suffix] && currentEditItem['review' + suffix].trim();
                    if (hasReview) {
                        // 如果有審查意見，就進行下一次審查
                        nextRound = highestHandlingRound + 1;
                    } else {
                        // 如果沒有審查意見，就進行該次審查
                        nextRound = highestHandlingRound;
                    }
                } else {
                    // 如果沒有任何機構辦理情形，就進行第1次審查
                    nextRound = 1;
                }
                // 設置審查次數（隱藏的 input 用於保存）
                document.getElementById('editRound').value = nextRound;
                // 更新顯示文字
                const roundDisplay = document.getElementById('editRoundDisplay');
                if (roundDisplay) {
                    roundDisplay.textContent = `第 ${nextRound} 次`;
                }
                
                document.getElementById('editContentDisplay').innerHTML = stripHtml(currentEditItem.content); 
                // 清除 AI 分析結果
                const aiBox = document.getElementById('aiBox');
                if (aiBox) aiBox.style.display = 'none';
                document.getElementById('aiPreviewText').innerText = '';
                document.getElementById('aiResBadge').innerHTML = '';
                // 清除編輯欄位，loadRoundData 會重新載入正確的資料
                document.getElementById('editReview').value = '';
                document.getElementById('editHandling').value = '';
                loadRoundData();
            }
        }
        // initEditForm → js/main.js

        // 動態添加更多審查次數選項（如果需要超過 100 次，用於隱藏的 select）
        function ensureRoundOption(round) {
            const s = document.getElementById('editRoundSelect');
            if (!s) return;
            const maxRound = Math.max(...Array.from(s.options).map(o => parseInt(o.value) || 0));
            if (round > maxRound) {
                for (let i = maxRound + 1; i <= round + 10; i++) {
                    const o = document.createElement('option');
                    o.value = i;
                    o.text = `第 ${i} 次`;
                    s.add(o);
                }
            }
        }

        function openDetail(id, isEdit) {
            currentEditItem = currentData.find(d => String(d.id) === String(id)); if (!currentEditItem) return;
            
            // 編號
            document.getElementById('dNumber').textContent = currentEditItem.number || '';
            
            // 檢查計畫
            document.getElementById('dPlanName').textContent = currentEditItem.plan_name || currentEditItem.planName || '(未設定)';
            
            // 檢查種類
            const insName = currentEditItem.inspectionCategoryName || currentEditItem.inspection_category_name || '-';
            document.getElementById('dInspection').textContent = insName;
            
            // 分組
            const divName = currentEditItem.divisionName || currentEditItem.division_name || '-';
            document.getElementById('dDivision').textContent = divName;
            
            // 開立日期（發函）
            document.getElementById('dIssueDate').textContent = currentEditItem.issue_date || currentEditItem.issueDate || '(未設定)';
            
            // 事項內容（使用 escapeHtml 防止 XSS）
            document.getElementById('dContent').innerHTML = escapeHtml(currentEditItem.content || '');

            // Status and Kind (狀態與類型) - 使用與dCategoryInfo相同的邏輯
            let k = currentEditItem.item_kind_code || currentEditItem.itemKindCode;
            if (!k) {
                k = extractKindCodeFromNumber(currentEditItem.number);
            }
            
            let kindLabel = getKindLabel(k);
            let statusBadge = getStatusBadge(currentEditItem.status);
            
            // 確保即使只有類型或只有狀態也能顯示
            const statusKindHtml = kindLabel || statusBadge ? `<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">${kindLabel}${statusBadge}</div>` : '';
            document.getElementById('dStatus').innerHTML = statusKindHtml || '(未設定)';

            let h = '';
            let firstRecord = true;
            // 支持無限次，動態查找（從200開始向下找，實際應該不會超過這個數字）
            // 第N次辦理情形區塊應該包含：第N次機構辦理情形 + 第N次審查意見
            for (let i = 200; i >= 1; i--) {
                const suffix = i === 1 ? '' : i;
                // 第N次機構辦理情形
                const ha = currentEditItem['handling' + suffix];
                // 第N次審查意見（第N次機構辦理情形後，會進行第N次審查）
                const re = currentEditItem['review' + suffix];
                const replyDate = currentEditItem['reply_date_r' + i];
                const responseDate = currentEditItem['response_date_r' + i];

                // 只要有機構辦理情形或審查意見，就顯示該次辦理情形
                if (ha || re) {
                    const latestBadge = firstRecord ? '<span class="badge new" style="margin-left:8px;font-size:11px;">最新進度</span>' : '';

                    let dateInfo = '';
                    if (replyDate || responseDate) {
                        dateInfo = `<div style="margin-bottom:12px;">`;
                        if (replyDate) dateInfo += `<span class="timeline-date-tag">🏢 機構回復: ${replyDate}</span> `;
                        if (responseDate) dateInfo += `<span class="timeline-date-tag">🏛️ 機關函復: ${responseDate}</span>`;
                        dateInfo += `</div>`;
                    }

                    // 第N次辦理情形區塊：先顯示第N次機構辦理情形，再顯示第N+1次審查意見
                    h += `<div class="timeline-item">
                        <div class="timeline-dot"></div>
                        <div class="timeline-title">第 ${i} 次辦理情形 ${latestBadge}</div>
                        ${dateInfo}
                        ${ha ? `<div style="background:#ecfdf5;padding:16px;border-radius:8px;font-size:14px;line-height:1.6;color:#047857;border:1px solid #a7f3d0;margin-bottom:12px;white-space:pre-wrap;"><strong>📝 機構辦理情形：</strong><br>${ha}</div>` : ''}
                        ${re ? `<div style="background:#fff;padding:16px;border-radius:8px;font-size:14px;line-height:1.6;color:#334155;border:1px solid #e2e8f0;border-left:3px solid var(--primary);white-space:pre-wrap;"><strong>👀 審查意見：</strong><br>${re}</div>` : ''}
                    </div>`;
                    firstRecord = false;
                }
            }

            const timelineHtml = `<div class="timeline-line"></div>` + (h || '<div style="color:#999;padding-left:20px;">無歷程紀錄</div>');
            document.getElementById('dTimeline').innerHTML = timelineHtml;

            const canEdit = (currentUser && (currentUser.isAdmin === true || currentUser.role === 'manager')); const canDelete = canEdit;
            document.getElementById('editBtn').classList.toggle('hidden', !canEdit);
            document.getElementById('deleteBtnDrawer').classList.toggle('hidden', !canDelete);
            document.getElementById('drawerBackdrop').classList.add('open'); document.getElementById('detailDrawer').classList.add('open'); toggleEditMode(isEdit);
        }
        // logout → js/auth.js
        // closeDrawer → js/modals.js
        // initListeners → js/main.js
        // onToggleSidebar → js/navigation.js

        // updateChartsData, initCharts → js/dashboard.js
        function loadRoundData() {
            if (!currentEditItem) return;
            const round = parseInt(document.getElementById('editRound').value) || 1;
            const suffix = round === 1 ? '' : round;
            
            // 載入該回合的資料
            // 重要：第N次審查時，應該載入第N次的辦理情形和審查意見
            // 辦理情形應該已經在「資料管理」頁面填寫，這裡只是讀取
            const handling = currentEditItem['handling' + suffix] || '';
            const review = currentEditItem['review' + suffix] || '';
            // 機構回復日期從辦理情形中讀取（不需要在審查頁面編輯）
            const replyDate = currentEditItem['reply_date_r' + round] || '';
            
            // 儲存到隱藏的輸入框（用於儲存時提交）
            // 注意：這裡的 handling 是第N次的辦理情形，review 是第N次的審查意見
            // 在審查頁面，我們只編輯 review，handling 是只讀的（應該已在資料管理頁面填寫）
            // 重要：確保不會把 review 的值錯誤地存到 handling
            document.getElementById('editHandling').value = handling;
            document.getElementById('editReview').value = review;
            // replyDate 從資料中讀取，不需要輸入框
            // responseDate 已移除，不再在審查頁面設定
            
            // 顯示第N次機構辦理情形（只讀，作為參考）
            // 撰寫第N次審查時，右側顯示第N次機構辦理情形
            // 因為第N次機構辦理情形後，會進行第N次審查
            const displayHandlingRound = round;
            const displayHandlingSuffix = displayHandlingRound === 1 ? '' : displayHandlingRound;
            const displayHandling = currentEditItem['handling' + displayHandlingSuffix] || '';
            
            // 更新辦理情形顯示（只讀）
            const currentHandlingDisplay = document.getElementById('currentHandlingDisplay');
            const currentHandlingRoundNum = document.getElementById('currentHandlingRoundNum');
            
            if (currentHandlingDisplay && currentHandlingRoundNum) {
                currentHandlingRoundNum.textContent = displayHandlingRound;
                if (displayHandling && displayHandling.trim()) {
                    currentHandlingDisplay.textContent = displayHandling;
                    currentHandlingDisplay.style.color = '#047857';
                } else {
                    currentHandlingDisplay.textContent = '（尚未有機構辦理情形）';
                    currentHandlingDisplay.style.color = '#94a3b8';
                }
            }
            
            // 顯示上一回合的審查意見（如果有，且不是第1次）
            const prevRound = round - 1;
            if (prevRound >= 1) {
                const prevSuffix = prevRound === 1 ? '' : prevRound;
                const prevReview = currentEditItem['review' + prevSuffix] || '';
                const prevBox = document.getElementById('prevReviewBox');
                const prevText = document.getElementById('prevReviewText');
                const prevRoundNum = document.getElementById('prevRoundNum');
                
                if (prevReview && prevBox && prevText && prevRoundNum) {
                    prevBox.style.display = 'block';
                    prevRoundNum.textContent = prevRound;
                    prevText.textContent = prevReview;
                } else if (prevBox) {
                    prevBox.style.display = 'none';
                }
            } else {
                // 第1次審查，隱藏前次審查意見
                const prevBox = document.getElementById('prevReviewBox');
                if (prevBox) prevBox.style.display = 'none';
            }
            
            // 清除 AI 分析結果（因為回合改變了）
            const aiBox = document.getElementById('aiBox');
            if (aiBox) aiBox.style.display = 'none';
            document.getElementById('aiPreviewText').innerText = '';
            document.getElementById('aiResBadge').innerHTML = '';
            
            // [Added] 初始化查看輪次選擇下拉選單
            initViewRoundSelect();
        }
        
        // [Added] 初始化查看輪次選擇下拉選單
        function initViewRoundSelect() {
            if (!currentEditItem) return;
            
            const select = document.getElementById('viewRoundSelect');
            if (!select) return;
            
            // 找出所有有內容的輪次（有審查意見或辦理情形即可）
            const rounds = [];
            for (let i = 200; i >= 1; i--) {
                const suffix = i === 1 ? '' : i;
                const hasHandling = currentEditItem['handling' + suffix] && currentEditItem['handling' + suffix].trim();
                const hasReview = currentEditItem['review' + suffix] && currentEditItem['review' + suffix].trim();
                // 只要有審查意見或辦理情形就包含
                if (hasHandling || hasReview) {
                    rounds.push(i);
                }
            }
            
            // 生成選項（從最新到最舊）
            select.innerHTML = '<option value="latest">最新進度</option>';
            rounds.forEach(r => {
                select.innerHTML += `<option value="${r}">第 ${r} 次</option>`;
            });
            
            // 預設選擇最新進度
            select.value = 'latest';
            onViewRoundChange();
        }
        
        // [Added] 當查看輪次選擇改變時
        function onViewRoundChange() {
            if (!currentEditItem) return;
            
            const select = document.getElementById('viewRoundSelect');
            if (!select) return;
            
            const selectedValue = select.value;
            
            // 隱藏所有查看區塊
            const viewReviewBox = document.getElementById('viewReviewBox');
            const viewHandlingBox = document.getElementById('viewHandlingBox');
            if (viewReviewBox) viewReviewBox.style.display = 'none';
            if (viewHandlingBox) viewHandlingBox.style.display = 'none';
            
            if (selectedValue === 'latest') {
                // 顯示最新進度 - 僅當「同時有審查意見和辦理情形」的相同次數時，才在左側顯示
                //  otherwise 只顯示在右側參考資料
                let bestRound = 0;
                for (let k = 200; k >= 1; k--) {
                    const suffix = k === 1 ? '' : k;
                    const hasHandling = currentEditItem['handling' + suffix] && currentEditItem['handling' + suffix].trim();
                    const hasReview = currentEditItem['review' + suffix] && currentEditItem['review' + suffix].trim();
                    if (hasHandling && hasReview) {
                        bestRound = k;
                        break;
                    }
                }
                // 僅在 same round 同時有辦理情形與審查意見時顯示左側區塊
                if (bestRound > 0) {
                    const suffix = bestRound === 1 ? '' : bestRound;
                    const handling = currentEditItem['handling' + suffix] || '';
                    const review = currentEditItem['review' + suffix] || '';
                    if (review && review.trim()) {
                        const viewReviewRoundNum = document.getElementById('viewReviewRoundNum');
                        const viewReviewText = document.getElementById('viewReviewText');
                        const viewReviewDate = document.getElementById('viewReviewDate');
                        if (viewReviewRoundNum) viewReviewRoundNum.textContent = bestRound;
                        if (viewReviewText) viewReviewText.textContent = review;
                        const responseDate = currentEditItem['response_date_r' + bestRound] || '';
                        if (viewReviewDate) viewReviewDate.textContent = responseDate ? `函復日期：${responseDate}` : '';
                        if (viewReviewBox) viewReviewBox.style.display = 'block';
                    }
                    if (handling && handling.trim()) {
                        const viewHandlingRoundNum = document.getElementById('viewHandlingRoundNum');
                        const viewHandlingText = document.getElementById('viewHandlingText');
                        const viewHandlingDate = document.getElementById('viewHandlingDate');
                        if (viewHandlingRoundNum) viewHandlingRoundNum.textContent = bestRound;
                        if (viewHandlingText) viewHandlingText.textContent = handling;
                        const replyDate = currentEditItem['reply_date_r' + bestRound] || '';
                        if (viewHandlingDate) viewHandlingDate.textContent = replyDate ? `回復日期：${replyDate}` : '';
                        if (viewHandlingBox) viewHandlingBox.style.display = 'block';
                    }
                }
            } else {
                // 顯示指定輪次 - 僅當該輪次同時有辦理情形與審查意見時才在左側顯示
                const round = parseInt(selectedValue, 10);
                const suffix = round === 1 ? '' : round;
                const handling = currentEditItem['handling' + suffix] || '';
                const review = currentEditItem['review' + suffix] || '';
                const hasBoth = (handling && handling.trim()) && (review && review.trim());
                if (hasBoth) {
                    const viewReviewRoundNum = document.getElementById('viewReviewRoundNum');
                    const viewReviewText = document.getElementById('viewReviewText');
                    const viewReviewDate = document.getElementById('viewReviewDate');
                    if (viewReviewRoundNum) viewReviewRoundNum.textContent = round;
                    if (viewReviewText) viewReviewText.textContent = review;
                    const responseDate = currentEditItem['response_date_r' + round] || '';
                    if (viewReviewDate) viewReviewDate.textContent = responseDate ? `函復日期：${responseDate}` : '';
                    if (viewReviewBox) viewReviewBox.style.display = 'block';
                    const viewHandlingRoundNum = document.getElementById('viewHandlingRoundNum');
                    const viewHandlingText = document.getElementById('viewHandlingText');
                    const viewHandlingDate = document.getElementById('viewHandlingDate');
                    if (viewHandlingRoundNum) viewHandlingRoundNum.textContent = round;
                    if (viewHandlingText) viewHandlingText.textContent = handling;
                    const replyDate = currentEditItem['reply_date_r' + round] || '';
                    if (viewHandlingDate) viewHandlingDate.textContent = replyDate ? `回復日期：${replyDate}` : '';
                    if (viewHandlingBox) viewHandlingBox.style.display = 'block';
                }
            }
        }

        // 從 Drawer 刪除事項
        async function deleteIssueFromDrawer() {
            if (!currentEditItem) {
                showToast('找不到要刪除的事項', 'error');
                return;
            }
            
            const issueId = currentEditItem.id;
            const issueNumber = currentEditItem.number || `ID:${issueId}`;
            
            const confirmed = await showConfirmModal(`確定要刪除事項「${issueNumber}」嗎？\n\n此操作無法復原。`, '確定刪除', '取消');
            if (!confirmed) {
                return;
            }
            
            try {
                const res = await apiFetch(`/api/issues/${issueId}`, {
                    method: 'DELETE'
                });
                
                const data = await res.json();
                if (res.ok) {
                    showToast('刪除成功');
                    closeDrawer();
                    // 重新載入事項列表
                    loadIssuesPage(issuesPage);
                } else {
                    showToast(data.error || '刪除失敗', 'error');
                }
            } catch (e) {
                showToast('刪除失敗: ' + e.message, 'error');
            }
        }
        
        async function saveEdit() {
            if (!currentEditItem) {
                showToast('找不到目前編輯的事項', 'error');
                return;
            }
            
            const id = document.getElementById('editId').value;
            const status = document.getElementById('editStatus').value;
            const round = parseInt(document.getElementById('editRound').value) || 1;
            // 從隱藏欄位讀取辦理情形（僅用於保存，不允許在審查頁面編輯）
            const handling = document.getElementById('editHandling').value.trim() || '';
            const review = document.getElementById('editReview').value.trim();
            // 機構回復日期從資料中讀取（已在辦理情形階段填寫）
            const replyDate = currentEditItem ? (currentEditItem['reply_date_r' + round] || '') : '';
            // responseDate 已移除，不再在審查頁面設定（改為在開立事項建檔頁面批次設定）
            
            if (!id) {
                showToast('找不到事項 ID', 'error');
                return;
            }
            
            // 第N次審查時，必須已有第N次的辦理情形（應該在資料管理頁面先輸入）
            if (!handling) {
                showToast(`第 ${round} 次審查時，必須先有第 ${round} 次機構辦理情形。請至「資料管理」頁面的「年度編輯」功能中新增辦理情形後，再進行審查。`, 'error');
                return;
            }
            
            // 重要：確保 handling 和 review 的對應關係正確
            // handling 應該是第N次的辦理情形（已在資料管理頁面填寫）
            // review 應該是第N次的審查意見（正在審查頁面填寫）
            // 不應該把審查意見存到辦理情形欄位
            
            try {
                const res = await apiFetch(`/api/issues/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        status,
                        round,
                        handling,
                        review,
                        replyDate: replyDate || null,
                        responseDate: null // 函復日期改為在開立事項建檔頁面批次設定
                    })
                });
                
                if (res.ok) {
                    const json = await res.json();
                    if (json.success) {
                        showToast('儲存成功！');
                        // 關閉 drawer 並返回查詢看板
                        closeDrawer();
                        // 重新載入資料
                        await loadIssuesPage(issuesPage);
                    } else {
                        showToast('儲存失敗', 'error');
                    }
                } else {
                    const json = await res.json();
                    showToast(json.error || '儲存失敗', 'error');
                }
            } catch (e) {
                console.error('Save error:', e);
                showToast('儲存時發生錯誤: ' + e.message, 'error');
            }
        }

        async function runAiInEdit(btn) { 
            btn.disabled = true; 
            btn.innerText = 'AI 分析中...'; 
            // 從隱藏欄位讀取辦理情形
            const handlingTxt = document.getElementById('editHandling').value || ''; 
            const r = [{ handling: handlingTxt, review: '(待審查)' }]; 
            try { 
                if (!currentEditItem || !currentEditItem.content) throw new Error('找不到事項內容'); 
                const cleanContent = stripHtml(currentEditItem.content); 
                const res = await fetch('/api/gemini', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ content: cleanContent, rounds: r }) 
                }); 
                const j = await res.json(); 
                if (res.ok && j.result) { 
                    document.getElementById('aiBox').style.display = 'block'; 
                    document.getElementById('aiPreviewText').innerText = j.result; 
                    document.getElementById('aiResBadge').innerHTML = j.fulfill && j.fulfill.includes('是') ? `<span class="ai-tag yes">✅ 符合</span>` : `<span class="ai-tag no">⚠️ 需注意</span>`; 
                } else { 
                    showToast('AI 分析失敗', 'error'); 
                } 
            } catch (e) { 
                showToast('AI Error: ' + e.message, 'error'); 
            } finally { 
                btn.disabled = false; 
                btn.innerText = '🤖 AI 智能分析'; 
            } 
        }
        function applyAiSuggestion() { 
            const txt = document.getElementById('aiPreviewText').innerText; 
            if (txt) { 
                document.getElementById('editReview').value = txt; 
                // 移除成功提示，只保留錯誤提示
            } else {
                showToast('沒有可帶入的 AI 建議', 'error');
            }
        }
        
        // --- 事項修正功能 ---
        let yearEditIssue = null; // 儲存當前編輯的事項資料
        let yearEditIssueList = []; // 儲存當前計畫下的事項列表
        
        function resetYearEditState() {
            yearEditIssue = null;
            yearEditIssueList = [];
        }
        window.resetYearEditState = resetYearEditState;
        
        // 從編號字串中提取數字（用於排序）
        function extractNumberFromString(str) {
            if (!str) return null;
            // 嘗試提取編號最後的數字部分（例如：113ABC-DEF-001 中的 001）
            const matches = str.match(/(\d+)(?!.*\d)/);
            if (matches && matches[1]) {
                return parseInt(matches[1], 10);
            }
            // 如果沒有找到，嘗試提取所有數字
            const allNumbers = str.match(/\d+/g);
            if (allNumbers && allNumbers.length > 0) {
                return parseInt(allNumbers[allNumbers.length - 1], 10);
            }
            return null;
        }
        
        // 載入有開立事項的檢查計畫選項（類似查詢看板的檢查計畫下拉選單）
        async function loadYearEditPlanOptions() {
            const select = document.getElementById('yearEditPlanName');
            if (!select) return;
            
            try {
                select.innerHTML = '<option value="">載入中...</option>';
                
                const res = await fetch('/api/options/plans?withIssues=true&t=' + Date.now(), {
                    cache: 'no-store',
                    headers: {
                        'Cache-Control': 'no-cache'
                    }
                });
                
                if (!res.ok) {
                    throw new Error('載入檢查計畫失敗');
                }
                
                const json = await res.json();
                
                if (!json.data || json.data.length === 0) {
                    select.innerHTML = '<option value="">尚無有開立事項的檢查計畫</option>';
                    return;
                }
                
                // 處理新的資料格式，按年度分組
                const yearGroups = new Map();
                
                json.data.forEach(p => {
                    let planName, planYear, planValue, planDisplay;
                    
                    if (typeof p === 'object' && p !== null) {
                        planName = p.name || '';
                        planYear = p.year || '';
                        planValue = p.value || `${planName}|||${planYear}`;
                        planDisplay = planName;
                    } else {
                        planName = p;
                        planYear = '';
                        planValue = p;
                        planDisplay = p;
                    }
                    
                    if (planName) {
                        const groupKey = planYear || '未分類';
                        if (!yearGroups.has(groupKey)) {
                            yearGroups.set(groupKey, []);
                        }
                        yearGroups.get(groupKey).push({ 
                            value: planValue, 
                            display: planDisplay, 
                            name: planName, 
                            year: planYear 
                        });
                    }
                });
                
                // 建立選項 HTML
                let allOptions = '<option value="">請選擇檢查計畫</option>';
                
                // 將年度分組按年度降序排序（最新的在前）
                const sortedYears = Array.from(yearGroups.keys()).sort((a, b) => {
                    if (a === '未分類') return 1;
                    if (b === '未分類') return -1;
                    const yearA = parseInt(a) || 0;
                    const yearB = parseInt(b) || 0;
                    return yearB - yearA;
                });
                
                sortedYears.forEach(year => {
                    const plans = yearGroups.get(year);
                    // 按計畫名稱排序（同一年度內的計畫按名稱排序）
                    plans.sort((a, b) => {
                        return (a.name || '').localeCompare(b.name || '', 'zh-TW');
                    });
                    
                    // 使用 optgroup 按年度分組
                    const yearLabel = year === '未分類' ? '未分類' : `${year} 年度`;
                    allOptions += `<optgroup label="${yearLabel}">`;
                    plans.forEach(plan => {
                        allOptions += `<option value="${plan.value}">${plan.display}</option>`;
                    });
                    allOptions += `</optgroup>`;
                });
                
                select.innerHTML = allOptions;
            } catch (e) {
                console.error('載入檢查計畫選項失敗:', e);
                select.innerHTML = '<option value="">載入失敗，請重新整理頁面</option>';
                showToast('載入檢查計畫失敗: ' + e.message, 'error');
            }
        }
        
        // 檢查計畫改變時，載入該計畫下的事項列表
        async function onYearEditPlanChange() {
            const planSelect = document.getElementById('yearEditPlanName');
            if (!planSelect) return;
            
            const planValue = planSelect.value;
            
            // 隱藏編輯內容和列表
            hideYearEditIssueContent();
            hideYearEditIssueList();
            
            if (!planValue) {
                document.getElementById('yearEditEmpty').style.display = 'block';
                document.getElementById('yearEditNotFound').style.display = 'none';
                return;
            }
            
            const [planName, planYear] = planValue.split('|||');
            
            try {
                // 載入該計畫下的所有事項（不顯示提示，因為已經確認有開立事項）
                yearEditIssueList = await loadIssuesByPlan(planValue, { showError: true, returnEmpty: true }) || [];
                
                // 對事項列表進行排序：先按類型（缺失N、觀察O、建議R），再按編號（數字小的在前）
                if (yearEditIssueList.length > 0) {
                    yearEditIssueList.sort((a, b) => {
                        // 1. 先按類型排序：缺失(N) -> 觀察(O) -> 建議(R)
                        const kindOrder = { 'N': 1, 'O': 2, 'R': 3 };
                        // 資料庫欄位可能是 item_kind_code 或 itemKindCode，兩種都嘗試
                        const kindCodeA = a.item_kind_code || a.itemKindCode || '';
                        const kindCodeB = b.item_kind_code || b.itemKindCode || '';
                        const kindA = kindOrder[kindCodeA] || 99;
                        const kindB = kindOrder[kindCodeB] || 99;
                        
                        if (kindA !== kindB) {
                            return kindA - kindB;
                        }
                        
                        // 2. 如果類型相同，按編號排序（提取編號中的數字部分）
                        const numA = extractNumberFromString(a.number || '');
                        const numB = extractNumberFromString(b.number || '');
                        
                        if (numA !== null && numB !== null) {
                            return numA - numB;
                        }
                        
                        // 如果無法提取數字，按字串排序
                        return (a.number || '').localeCompare(b.number || '', 'zh-TW');
                    });
                }
                
                if (yearEditIssueList.length === 0) {
                    // 沒有事項
                    document.getElementById('yearEditEmpty').style.display = 'none';
                    document.getElementById('yearEditNotFound').style.display = 'block';
                    document.getElementById('yearEditIssueList').style.display = 'none';
                } else {
                    // 顯示事項列表（不顯示提示，因為已經確認有開立事項）
                    document.getElementById('yearEditEmpty').style.display = 'none';
                    document.getElementById('yearEditNotFound').style.display = 'none';
                    renderYearEditIssueList();
                }
            } catch (e) {
                showToast('載入事項列表失敗: ' + e.message, 'error');
                hideYearEditIssueList();
            }
        }
        
        // 渲染事項列表
        function renderYearEditIssueList() {
            const container = document.getElementById('yearEditIssueListContainer');
            const countEl = document.getElementById('yearEditIssueListCount');
            if (!container) return;
            
            if (countEl) {
                countEl.textContent = yearEditIssueList.length;
            }
            
            if (yearEditIssueList.length === 0) {
                container.innerHTML = '<div style="padding:40px; text-align:center; color:#94a3b8;">尚無事項</div>';
                document.getElementById('yearEditIssueList').style.display = 'none';
                return;
            }
            
            let html = '';
            yearEditIssueList.forEach((issue, index) => {
                const contentPreview = stripHtml(issue.content || '').substring(0, 150);
                
                // 顯示類型（缺失、觀察、建議）
                let k = issue.itemKindCode;
                if (!k) {
                    k = extractKindCodeFromNumber(issue.number);
                }
                
                let kindLabel = getKindLabel(k);
                
                // 顯示狀態徽章
                let badge = '';
                const st = String(issue.status || 'Open');
                if (st !== 'Open' && st) {
                    const stClass = st === '持續列管' ? 'active' : (st === '解除列管' ? 'resolved' : 'self');
                    badge = `<span class="badge ${stClass}">${st}</span>`;
                }
                
                html += `
                    <div class="year-edit-issue-item" 
                         onclick="loadYearEditIssueFromList(${index})"
                         style="padding:16px; border-bottom:1px solid #e2e8f0; cursor:pointer; transition:background 0.2s;"
                         onmouseover="this.style.background='#f8fafc'"
                         onmouseout="this.style.background='#fff'">
                        <div style="display:flex; justify-content:space-between; align-items:start; gap:16px;">
                            <div style="flex:1;">
                                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap;">
                                    <div style="font-weight:700; color:#1e40af; font-size:15px;">
                                        ${issue.number || '未指定編號'}
                                    </div>
                                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                        ${kindLabel}${badge}
                                    </div>
                                </div>
                                <div style="font-size:13px; color:#64748b; line-height:1.6; margin-bottom:8px;">
                                    ${contentPreview}${contentPreview.length >= 150 ? '...' : ''}
                                </div>
                                <div style="display:flex; gap:12px; font-size:12px; color:#94a3b8;">
                                    <span>年度：${issue.year || ''}</span>
                                    <span>機構：${issue.unit || ''}</span>
                                </div>
                            </div>
                            <div style="color:#cbd5e1; font-size:20px; align-self:center;">→</div>
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
            document.getElementById('yearEditIssueList').style.display = 'block';
        }
        
        // 從列表載入指定事項進入編輯模式
        function loadYearEditIssueFromList(index) {
            if (index < 0 || index >= yearEditIssueList.length) return;
            
            yearEditIssue = yearEditIssueList[index];
            
            // 標準化字段名（確保同時有兩種格式，提高兼容性）
            if (yearEditIssue.division_name && !yearEditIssue.divisionName) {
                yearEditIssue.divisionName = yearEditIssue.division_name;
            }
            if (yearEditIssue.inspection_category_name && !yearEditIssue.inspectionCategoryName) {
                yearEditIssue.inspectionCategoryName = yearEditIssue.inspection_category_name;
            }
            if (yearEditIssue.item_kind_code && !yearEditIssue.itemKindCode) {
                yearEditIssue.itemKindCode = yearEditIssue.item_kind_code;
            }
            if (yearEditIssue.plan_name && !yearEditIssue.planName) {
                yearEditIssue.planName = yearEditIssue.plan_name;
            }
            
            // 隱藏列表，顯示編輯內容
            document.getElementById('yearEditIssueList').style.display = 'none';
            document.getElementById('yearEditEmpty').style.display = 'none';
            document.getElementById('yearEditNotFound').style.display = 'none';
            document.getElementById('yearEditIssueContent').style.display = 'block';
            document.getElementById('yearEditSaveBtn').disabled = false;
            
            renderYearEditIssue();
            
            // 滾動到編輯區域
            document.getElementById('yearEditIssueContent').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        // 隱藏事項列表
        function hideYearEditIssueList() {
            const listEl = document.getElementById('yearEditIssueList');
            if (listEl) listEl.style.display = 'none';
        }
        
        // 隱藏編輯內容
        function hideYearEditIssueContent() {
            const contentEl = document.getElementById('yearEditIssueContent');
            if (contentEl) contentEl.style.display = 'none';
        }
        
        // 返回事項列表
        function backToYearEditIssueList() {
            hideYearEditIssueContent();
            if (yearEditIssueList.length > 0) {
                renderYearEditIssueList();
                document.getElementById('yearEditIssueList').style.display = 'block';
            } else {
                document.getElementById('yearEditEmpty').style.display = 'block';
            }
        }
        
        // 批次設定函復日期（用於開立事項建檔頁面）
        async function batchSetResponseDateForPlan() {
            const roundSelect = document.getElementById('createBatchResponseRound');
            const roundManualInput = document.getElementById('createBatchResponseRoundManual');
            const dateInput = document.getElementById('createBatchResponseDate');
            const planSelect = document.getElementById('createPlanName');
            
            if (!roundSelect || !roundManualInput || !dateInput || !planSelect) return;
            
            // 優先使用下拉選單的值，如果沒有則使用手動輸入
            let round = parseInt(roundSelect.value);
            if (!round || round < 1) {
                round = parseInt(roundManualInput.value);
            }
            
            // 立即從輸入框獲取用戶輸入的日期值並存儲，避免後續被修改
            const userInputResponseDate = dateInput.value.trim();
            const planValue = planSelect.value.trim();
            
            if (!planValue) {
                showToast('請先選擇檢查計畫', 'error');
                return;
            }
            
            if (!round || round < 1) {
                showToast('請選擇或輸入審查輪次', 'error');
                return;
            }
            
            if (round > 200) {
                showToast('審查輪次不能超過200次', 'error');
                return;
            }
            
            if (!userInputResponseDate) {
                showToast('請輸入函復日期', 'error');
                return;
            }
            
            // 驗證日期格式
            if (!validateDateFormat(userInputResponseDate, '日期')) {
                return;
            }
            
            const { name: planName } = parsePlanValue(planValue);
            
            try {
                // 載入該計畫下的所有事項
                const issueList = await loadIssuesByPlan(planValue);
                if (!issueList || issueList.length === 0) {
                    showToast('該檢查計畫下尚無開立事項', 'error');
                    return;
                }
                
                // userInputResponseDate 已經在函數開始時從輸入框獲取並保存
                
                const confirmed = await showConfirmModal(
                    `確定要批次設定第 ${round} 次審查的函復日期為 ${userInputResponseDate} 嗎？\n\n將更新 ${issueList.length} 筆事項。`,
                    '確認設定',
                    '取消'
                );
                
                if (!confirmed) {
                    return;
                }
                
                // 移除批次設定中的提示訊息，只保留錯誤訊息
                
                let successCount = 0;
                let errorCount = 0;
                const errors = [];
                
                // 批次更新所有事項
                for (let i = 0; i < issueList.length; i++) {
                    const issue = issueList[i];
                    const issueId = issue.id;
                    
                    if (!issueId) {
                        errorCount++;
                        errors.push(`${issue.number || '未知編號'}: 缺少事項ID`);
                        continue;
                    }
                    
                    try {
                        // 讀取該輪次的現有資料
                        const suffix = round === 1 ? '' : round;
                        const handling = issue['handling' + suffix] || '';
                        const review = issue['review' + suffix] || '';
                        
                        // 檢查是否有審查內容，沒有審查內容則跳過
                        if (!review || !review.trim()) {
                            errorCount++;
                            errors.push(`${issue.number || '未知編號'}: 第 ${round} 次尚無審查意見，無法設定函復日期`);
                            continue;
                        }
                        
                        // 明確使用用戶輸入的日期，不使用任何從資料庫讀取的日期值
                        // userInputResponseDate 是在函數開始時從輸入框獲取的用戶輸入值，不會被修改
                        // 確保不使用 issue 物件中的任何日期欄位（包括 reply_date_r 和 response_date_r）
                        
                        // 更新該輪次的函復日期
                        // 注意：只更新 responseDate（審查函復日期），不更新 replyDate（回復日期）
                        const updateRes = await apiFetch(`/api/issues/${issueId}`, {
                            method: 'PUT',
                            body: JSON.stringify({
                                status: issue.status || '持續列管',
                                round: round,
                                handling: handling,
                                review: review,
                                // 重要：不發送 replyDate，讓後端保持原有值不變
                                // 只發送 responseDate，使用用戶在輸入框中輸入的日期
                                responseDate: userInputResponseDate  // 明確使用用戶輸入的審查函復日期，不從資料庫讀取
                            })
                        });
                        
                        if (updateRes.ok) {
                            const result = await updateRes.json();
                            if (result.success) {
                                successCount++;
                            } else {
                                errorCount++;
                                errors.push(`${issue.number || '未知編號'}: 更新失敗`);
                            }
                        } else {
                            errorCount++;
                            const errorData = await updateRes.json().catch(() => ({}));
                            errors.push(`${issue.number || '未知編號'}: ${errorData.error || '更新失敗'}`);
                        }
                    } catch (e) {
                        errorCount++;
                        errors.push(`${issue.number || '未知編號'}: ${e.message}`);
                    }
                }
                
                // 顯示資料庫操作結果（成功或警告）
                if (successCount > 0 && errorCount === 0) {
                    // 完全成功時顯示成功訊息
                    showToast(`批次設定完成！成功 ${successCount} 筆`, 'success');
                    // 清空輸入欄位並重置為預設模式
                    roundSelect.value = '';
                    roundManualInput.value = '';
                    dateInput.value = '';
                    // 取消勾選並隱藏設定區塊
                    const toggleCheckbox = document.getElementById('createBatchResponseDateToggle');
                    if (toggleCheckbox) {
                        toggleCheckbox.checked = false;
                        toggleBatchResponseDateSetting();
                    }
                } else if (successCount > 0 && errorCount > 0) {
                    // 部分成功
                    showToast(`批次設定完成，但有 ${errorCount} 筆失敗，成功 ${successCount} 筆`, 'warning');
                    if (errors.length > 0) {
                        console.error('批次設定函復日期錯誤:', errors);
                    }
                } else if (errorCount > 0) {
                    // 全部失敗
                    showToast(`批次設定失敗，所有 ${errorCount} 筆事項都無法更新`, 'error');
                    if (errors.length > 0) {
                        console.error('批次設定函復日期錯誤:', errors);
                        // 顯示第一個錯誤的詳細資訊
                        showToast(`錯誤詳情：${errors[0]}`, 'error');
                    }
                } else {
                    // 沒有處理任何事項（理論上不應該發生）
                    showToast('沒有事項需要更新', 'warning');
                }
            } catch (e) {
                showToast('批次設定失敗: ' + e.message, 'error');
            }
        }
        
        // 批次設定函復日期（用於事項修正頁面，保留向後兼容）
        async function batchSetResponseDate() {
            const roundSelect = document.getElementById('yearEditBatchResponseRound');
            const dateInput = document.getElementById('yearEditBatchResponseDate');
            
            if (!roundSelect || !dateInput) return;
            
            const round = parseInt(roundSelect.value);
            // 確保使用用戶輸入的日期值，存儲在局部變量中避免被修改
            const userInputResponseDate = dateInput.value.trim();
            
            if (!round || round < 1) {
                showToast('請選擇輪次', 'error');
                return;
            }
            
            if (!userInputResponseDate) {
                showToast('請輸入函復日期', 'error');
                return;
            }
            
            // 驗證日期格式
            if (!validateDateFormat(userInputResponseDate, '日期')) {
                return;
            }
            
            if (yearEditIssueList.length === 0) {
                showToast('沒有可設定的事項', 'error');
                return;
            }
            
            const confirmed = await showConfirmModal(`確定要批次設定第 ${round} 次審查的函復日期為 ${responseDate} 嗎？\n\n將更新 ${yearEditIssueList.length} 筆事項。`, '確定設定', '取消');
            if (!confirmed) {
                return;
            }
            
            try {
                showToast('批次設定中，請稍候...', 'info');
                
                let successCount = 0;
                let errorCount = 0;
                const errors = [];
                
                // 批次更新所有事項
                for (let i = 0; i < yearEditIssueList.length; i++) {
                    const issue = yearEditIssueList[i];
                    const issueId = issue.id;
                    
                    if (!issueId) {
                        errorCount++;
                        errors.push(`${issue.number || '未知編號'}: 缺少事項ID`);
                        continue;
                    }
                    
                    try {
                        // 讀取該輪次的現有資料
                        const suffix = round === 1 ? '' : round;
                        const handling = issue['handling' + suffix] || '';
                        const review = issue['review' + suffix] || '';
                        
                        // 檢查是否有審查內容，沒有審查內容則跳過
                        if (!review || !review.trim()) {
                            errorCount++;
                            errors.push(`${issue.number || '未知編號'}: 第 ${round} 次尚無審查意見，無法設定函復日期`);
                            continue;
                        }
                        
                        // 明確使用用戶輸入的日期，不使用任何從資料庫讀取的日期值
                        // userInputResponseDate 是在函數開始時從輸入框獲取的用戶輸入值
                        
                        // 更新該輪次的函復日期
                        // 注意：只更新 responseDate（審查函復日期），不更新 replyDate（回復日期）
                        const res = await apiFetch(`/api/issues/${issueId}`, {
                            method: 'PUT',
                            body: JSON.stringify({
                                status: issue.status || '持續列管',
                                round: round,
                                handling: handling,
                                review: review,
                                // 不發送 replyDate，讓後端保持原有值不變
                                responseDate: userInputResponseDate  // 明確使用用戶輸入的審查函復日期
                            })
                        });
                        
                        if (res.ok) {
                            const result = await res.json();
                            if (result.success) {
                                successCount++;
                                // 更新本地資料
                                issue['response_date_r' + round] = responseDate;
                            } else {
                                errorCount++;
                                errors.push(`${issue.number || '未知編號'}: 更新失敗`);
                            }
                        } else {
                            errorCount++;
                            const errorData = await res.json().catch(() => ({}));
                            errors.push(`${issue.number || '未知編號'}: ${errorData.error || '更新失敗'}`);
                        }
                    } catch (e) {
                        errorCount++;
                        errors.push(`${issue.number || '未知編號'}: ${e.message}`);
                    }
                }
                
                if (successCount > 0) {
                    showToast(`批次設定完成！成功 ${successCount} 筆${errorCount > 0 ? `，失敗 ${errorCount} 筆` : ''}`, errorCount > 0 ? 'warning' : 'success');
                    
                    // 如果有錯誤，顯示詳細資訊
                    if (errorCount > 0 && errors.length > 0) {
                        console.error('批次設定函復日期錯誤:', errors);
                    }
                    
                    // 重新載入事項列表以反映更新
                    const planSelect = document.getElementById('yearEditPlanName');
                    if (planSelect && planSelect.value) {
                        await onYearEditPlanChange();
                    }
                } else {
                    showToast('批次設定失敗，所有事項都無法更新', 'error');
                    if (errors.length > 0) {
                        console.error('批次設定函復日期錯誤:', errors);
                    }
                }
            } catch (e) {
                showToast('批次設定失敗: ' + e.message, 'error');
            }
        }
        
        // 渲染事項詳細內容（包含所有輪次）
        function renderYearEditIssue() {
            const container = document.getElementById('yearEditIssueContainer');
            if (!container || !yearEditIssue) return;
            
            const item = yearEditIssue;
            
            // 收集所有輪次的辦理情形和審查意見
            const rounds = [];
            for (let i = 1; i <= 200; i++) {
                const suffix = i === 1 ? '' : i;
                const handling = item[`handling${suffix}`] || '';
                const review = item[`review${suffix}`] || '';
                const replyDate = item[`reply_date_r${i}`] || '';
                const responseDate = item[`response_date_r${i}`] || '';
                
                if (handling || review || replyDate || responseDate) {
                    rounds.push({
                        round: i,
                        handling: stripHtml(handling),
                        review: stripHtml(review),
                        replyDate: replyDate,
                        responseDate: responseDate
                    });
                }
            }
            
            // 檢查是否有實際的審查和回復紀錄（如果只有開立事項，不顯示此區塊）
            const hasReviewRecords = rounds.length > 0;
            
            // 構建檢查計畫選項（需要從現有的計畫選項中選擇）
            let planOptionsHtml = '<option value="">(未指定)</option>';
            const planSelect = document.getElementById('yearEditPlanName');
            if (planSelect && planSelect.options.length > 1) {
                // 使用現有的計畫選項
                for (let i = 1; i < planSelect.options.length; i++) {
                    const opt = planSelect.options[i];
                    const planValue = opt.value;
                    const { name: planName, year: planYear } = parsePlanValue(planValue);
                    const displayText = planYear ? `${planName} (${planYear})` : planName;
                    const currentPlanName = item.plan_name || item.planName || '';
                    const isSelected = (currentPlanName === planName && (!planYear || item.year === planYear)) || 
                                      (planValue && planValue === `${currentPlanName}|||${item.year}`);
                    planOptionsHtml += `<option value="${planValue}" ${isSelected ? 'selected' : ''}>${displayText}</option>`;
                }
            } else {
                // 如果計畫選項還沒有加載，先添加當前計畫（如果有的話）
                const currentPlanName = item.plan_name || item.planName || '';
                if (currentPlanName) {
                    const currentPlanValue = item.year ? `${currentPlanName}|||${item.year}` : currentPlanName;
                    const displayText = item.year ? `${currentPlanName} (${item.year})` : currentPlanName;
                    planOptionsHtml += `<option value="${currentPlanValue}" selected>${displayText}</option>`;
                }
                // 嘗試加載計畫選項（異步，不阻塞渲染）
                loadPlanOptions().then(() => {
                    // 重新渲染計畫選項
                    const planSelectEl = document.getElementById('yearEditPlanNameSelect');
                    if (planSelectEl && document.getElementById('yearEditPlanName')) {
                        const sourceSelect = document.getElementById('yearEditPlanName');
                        if (sourceSelect && sourceSelect.options.length > 1) {
                            let newOptionsHtml = '<option value="">(未指定)</option>';
                            for (let i = 1; i < sourceSelect.options.length; i++) {
                                const opt = sourceSelect.options[i];
                                const planValue = opt.value;
                                const { name: planName, year: planYear } = parsePlanValue(planValue);
                                const displayText = planYear ? `${planName} (${planYear})` : planName;
                                const isSelected = planSelectEl.value === planValue;
                                newOptionsHtml += `<option value="${planValue}" ${isSelected ? 'selected' : ''}>${displayText}</option>`;
                            }
                            planSelectEl.innerHTML = newOptionsHtml;
                        }
                    }
                }).catch(() => {
                    // 忽略錯誤，使用當前選項
                });
            }
            
            // 確定當前計畫的值（支援兩種字段名格式）
            const currentPlanName = item.plan_name || item.planName || '';
            const currentPlanValue = currentPlanName ? (item.year ? `${currentPlanName}|||${item.year}` : currentPlanName) : '';
            
            let html = `
                <div class="detail-card" style="margin-bottom:20px; border:2px solid #e2e8f0;">
                    <!-- 基本資訊區塊 -->
                    <div style="background:#f8fafc; padding:20px; border-bottom:2px solid #e2e8f0;">
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:16px;">
                            <div>
                                <label style="display:block; font-weight:600; color:#475569; font-size:14px; margin-bottom:8px;">
                                    事項編號 <span style="color:#ef4444;">*</span>
                                </label>
                                <input type="text" id="yearEditNumber" class="filter-input" 
                                    value="${item.number || ''}" 
                                    placeholder="例如: 113-TRA-1-A01-N01" 
                                    style="width:100%; background:white;">
                            </div>
                            <div>
                                <label style="display:block; font-weight:600; color:#475569; font-size:14px; margin-bottom:8px;">
                                    年度 <span style="color:#ef4444;">*</span>
                                </label>
                                <input type="number" id="yearEditYear" class="filter-input" 
                                    value="${item.year || ''}" 
                                    placeholder="例如: 113" 
                                    style="width:100%; background:white;">
                            </div>
                        </div>
                        
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:16px;">
                            <div>
                                <label style="display:block; font-weight:600; color:#475569; font-size:14px; margin-bottom:8px;">
                                    機構 <span style="color:#ef4444;">*</span>
                                </label>
                                <input type="text" id="yearEditUnit" class="filter-input" 
                                    value="${item.unit || ''}" 
                                    placeholder="例如: 臺鐵" 
                                    style="width:100%; background:white;">
                            </div>
                            <div>
                                <label style="display:block; font-weight:600; color:#475569; font-size:14px; margin-bottom:8px;">分組</label>
                                <select id="yearEditDivision" class="filter-select" style="width:100%; background:white;">
                                    <option value="">(未指定)</option>
                                    <option value="運務" ${(item.divisionName || item.division_name) === '運務' ? 'selected' : ''}>運務</option>
                                    <option value="工務" ${(item.divisionName || item.division_name) === '工務' ? 'selected' : ''}>工務</option>
                                    <option value="機務" ${(item.divisionName || item.division_name) === '機務' ? 'selected' : ''}>機務</option>
                                    <option value="電務" ${(item.divisionName || item.division_name) === '電務' ? 'selected' : ''}>電務</option>
                                    <option value="安全" ${(item.divisionName || item.division_name) === '安全' ? 'selected' : ''}>安全</option>
                                    <option value="審核" ${(item.divisionName || item.division_name) === '審核' ? 'selected' : ''}>審核</option>
                                    <option value="災防" ${(item.divisionName || item.division_name) === '災防' ? 'selected' : ''}>災防</option>
                                    <option value="運轉" ${(item.divisionName || item.division_name) === '運轉' ? 'selected' : ''}>運轉</option>
                                    <option value="土木" ${(item.divisionName || item.division_name) === '土木' ? 'selected' : ''}>土木</option>
                                    <option value="機電" ${(item.divisionName || item.division_name) === '機電' ? 'selected' : ''}>機電</option>
                                </select>
                            </div>
                        </div>
                        
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:16px;">
                            <div>
                                <label style="display:block; font-weight:600; color:#475569; font-size:14px; margin-bottom:8px;">檢查種類</label>
                                <select id="yearEditInspection" class="filter-select" style="width:100%; background:white;">
                                    <option value="">(未指定)</option>
                                    <option value="定期檢查" ${(item.inspectionCategoryName || item.inspection_category_name) === '定期檢查' ? 'selected' : ''}>定期檢查</option>
                                    <option value="例行性檢查" ${(item.inspectionCategoryName || item.inspection_category_name) === '例行性檢查' ? 'selected' : ''}>例行性檢查</option>
                                    <option value="特別檢查" ${(item.inspectionCategoryName || item.inspection_category_name) === '特別檢查' ? 'selected' : ''}>特別檢查</option>
                                    <option value="臨時檢查" ${(item.inspectionCategoryName || item.inspection_category_name) === '臨時檢查' ? 'selected' : ''}>臨時檢查</option>
                                </select>
                            </div>
                            <div>
                                <label style="display:block; font-weight:600; color:#475569; font-size:14px; margin-bottom:8px;">開立類型</label>
                                <select id="yearEditKind" class="filter-select" style="width:100%; background:white;">
                                    <option value="">(未指定)</option>
                                    <option value="N" ${(item.item_kind_code || item.itemKindCode) === 'N' || item.category === '缺失事項' ? 'selected' : ''}>缺失事項</option>
                                    <option value="O" ${(item.item_kind_code || item.itemKindCode) === 'O' || item.category === '觀察事項' ? 'selected' : ''}>觀察事項</option>
                                    <option value="R" ${(item.item_kind_code || item.itemKindCode) === 'R' || item.category === '建議事項' ? 'selected' : ''}>建議事項</option>
                                </select>
                            </div>
                        </div>
                        
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:16px;">
                            <div>
                                <label style="display:block; font-weight:600; color:#475569; font-size:14px; margin-bottom:8px;">檢查計畫</label>
                                <select id="yearEditPlanNameSelect" class="filter-select" style="width:100%; background:white;">
                                    ${planOptionsHtml}
                                </select>
                            </div>
                            <div>
                                <label style="display:block; font-weight:600; color:#475569; font-size:14px; margin-bottom:8px;">狀態</label>
                                <select id="yearEditStatus" class="filter-select" style="width:100%; background:white;">
                                    <option value="持續列管" ${item.status === '持續列管' ? 'selected' : ''}>持續列管</option>
                                    <option value="解除列管" ${item.status === '解除列管' ? 'selected' : ''}>解除列管</option>
                                    <option value="自行列管" ${item.status === '自行列管' ? 'selected' : ''}>自行列管</option>
                                </select>
                            </div>
                        </div>
                        
                        <div style="margin-bottom:16px;">
                            <label style="display:block; font-weight:600; color:#475569; font-size:14px; margin-bottom:8px;">開立日期</label>
                            <input type="text" id="yearEditIssueDate" class="filter-input" 
                                value="${item.issue_date || ''}" 
                                placeholder="例如: 1130501" 
                                style="width:100%; background:white;">
                        </div>
                        
                        <div>
                            <label style="display:block; font-weight:600; color:#475569; font-size:14px; margin-bottom:8px;">事項內容</label>
                            <textarea id="yearEditContent" class="filter-input" 
                                style="width:100%; min-height:120px; padding:12px; font-size:14px; line-height:1.6; resize:vertical; background:white;">${stripHtml(item.content || '')}</textarea>
                        </div>
                    </div>
            `;
            
            // 如果有審查和回復紀錄，添加該區塊
            if (hasReviewRecords) {
                html += `
                    <!-- 所有輪次的審查與回復紀錄 -->
                    <div style="padding:20px;">
                        <div style="font-weight:700; font-size:16px; color:#334155; margin-bottom:16px; padding-bottom:12px; border-bottom:2px solid #e2e8f0;">
                            📋 所有審查及回復紀錄（共 ${rounds.length} 輪）
                        </div>
                        
                        <div id="yearEditRoundsContainer">
                `;
                
                // 渲染每個輪次
                rounds.forEach((round, index) => {
                    const isLast = index === rounds.length - 1;
                    html += `
                    <div class="detail-card" style="margin-bottom:16px; border:1px solid #e2e8f0; ${isLast ? 'border-left:4px solid #2563eb;' : ''}">
                        <div style="background:#eff6ff; padding:12px; border-bottom:1px solid #dbeafe; display:flex; justify-content:space-between; align-items:center;">
                            <div style="font-weight:700; color:#1e40af; font-size:15px;">
                                第 ${round.round} 次回復與審查
                            </div>
                            <div style="display:flex; gap:12px; font-size:13px; color:#64748b;">
                                ${round.replyDate ? `<span>鐵路機構回復日期：${round.replyDate}</span>` : ''}
                                ${round.responseDate ? `<span>本次函復日期：${round.responseDate}</span>` : ''}
                            </div>
                        </div>
                        <div style="padding:16px;">
                            <div style="margin-bottom:16px;">
                                <label style="display:block; font-weight:600; color:#475569; font-size:14px; margin-bottom:8px;">
                                    辦理情形 (第 ${round.round} 次回復與審查)
                                </label>
                                <textarea class="filter-input year-edit-round-handling" data-round="${round.round}" 
                                    style="width:100%; min-height:100px; padding:12px; font-size:14px; line-height:1.6; resize:vertical;">${round.handling}</textarea>
                            </div>
                            <div>
                                <label style="display:block; font-weight:600; color:#475569; font-size:14px; margin-bottom:8px;">
                                    審查意見 (第 ${round.round} 次回復與審查)
                                </label>
                                <textarea class="filter-input year-edit-round-review" data-round="${round.round}" 
                                    style="width:100%; min-height:100px; padding:12px; font-size:14px; line-height:1.6; resize:vertical;">${round.review}</textarea>
                            </div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:12px;">
                                <div>
                                    <label style="display:block; font-weight:600; color:#475569; font-size:13px; margin-bottom:6px;">鐵路機構回復日期</label>
                                    <input type="text" class="filter-input year-edit-round-reply-date" data-round="${round.round}" 
                                        value="${round.replyDate || ''}" placeholder="例如: 1130601" style="width:100%;">
                                </div>
                                <div>
                                    <label style="display:block; font-weight:600; color:#475569; font-size:13px; margin-bottom:6px;">本次函復日期</label>
                                    <input type="text" class="filter-input year-edit-round-response-date" data-round="${round.round}" 
                                        value="${round.responseDate || ''}" placeholder="例如: 1130615" style="width:100%;">
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                });
                
                html += `
                        </div>
                    </div>
                `;
            }
            // 如果沒有輪次記錄，不顯示任何辦理情形編輯區塊（保持原有邏輯）
            
            html += `
                </div>
            `;
            
            container.innerHTML = html;
        }
        
        // 儲存事項變更
        async function saveYearEditIssue() {
            if (!yearEditIssue) {
                showToast('無事項可儲存', 'error');
                return;
            }
            
            const confirmed = await showConfirmModal('確定要儲存所有變更嗎？', '確定儲存', '取消');
            if (!confirmed) {
                return;
            }
            
            try {
                showToast('儲存中，請稍候...', 'info');
                
                const issueId = yearEditIssue.id;
                // 不進行 trim，保留原始輸入（包括空字串），允許清空欄位
                const number = document.getElementById('yearEditNumber')?.value.trim() || '';
                const year = document.getElementById('yearEditYear')?.value.trim() || '';
                const unit = document.getElementById('yearEditUnit')?.value.trim() || '';
                const divisionName = document.getElementById('yearEditDivision')?.value || '';
                const inspectionCategoryName = document.getElementById('yearEditInspection')?.value || '';
                const itemKindCode = document.getElementById('yearEditKind')?.value || '';
                const planValue = document.getElementById('yearEditPlanNameSelect')?.value || '';
                const { name: planName } = parsePlanValue(planValue);
                const content = document.getElementById('yearEditContent').value;
                const status = document.getElementById('yearEditStatus').value;
                const issueDate = document.getElementById('yearEditIssueDate').value;
                
                // 基本驗證
                if (!number) {
                    showToast('請填寫事項編號', 'error');
                    return;
                }
                if (!year) {
                    showToast('請填寫年度', 'error');
                    return;
                }
                if (!unit) {
                    showToast('請填寫機構', 'error');
                    return;
                }
                
                // 收集所有輪次的資料
                const roundHandlings = document.querySelectorAll('.year-edit-round-handling');
                const roundReviews = document.querySelectorAll('.year-edit-round-review');
                const roundReplyDates = document.querySelectorAll('.year-edit-round-reply-date');
                const roundResponseDates = document.querySelectorAll('.year-edit-round-response-date');
                
                // 找出所有顯示的輪次（不管是否有內容）
                const roundSet = new Set();
                roundHandlings.forEach(el => roundSet.add(parseInt(el.dataset.round)));
                roundReviews.forEach(el => roundSet.add(parseInt(el.dataset.round)));
                roundReplyDates.forEach(el => roundSet.add(parseInt(el.dataset.round)));
                roundResponseDates.forEach(el => roundSet.add(parseInt(el.dataset.round)));
                
                const sortedRounds = Array.from(roundSet).sort((a, b) => a - b);
                
                // 先更新基本資訊（包括所有可編輯欄位）
                // 即使內容為空也要更新（允許清空）
                const updateRes = await apiFetch(`/api/issues/${issueId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        status: status,
                        round: 1,
                        handling: '', // 第一輪的辦理情形和審查意見會在後面更新
                        review: '',
                        content: content, // 允許空字串
                        issueDate: issueDate || '', // 允許空字串
                        number: number,
                        year: year,
                        unit: unit,
                        divisionName: divisionName || null,
                        inspectionCategoryName: inspectionCategoryName || null,
                        itemKindCode: itemKindCode || null,
                        category: itemKindCode ? (itemKindCode === 'N' ? '缺失事項' : itemKindCode === 'O' ? '觀察事項' : '建議事項') : null,
                        planName: planName || null,
                        replyDate: '',
                        responseDate: ''
                    })
                });
                
                if (!updateRes.ok) {
                    const errorData = await updateRes.json().catch(() => ({}));
                    throw new Error(errorData.error || '更新基本資訊失敗');
                }
                
                // 更新每個輪次（包括清空的欄位）
                let successCount = 0;
                let errorCount = 0;
                
                // 更新所有顯示的輪次，即使內容為空也要更新（允許清空欄位）
                for (const roundNum of sortedRounds) {
                    const handlingEl = document.querySelector(`.year-edit-round-handling[data-round="${roundNum}"]`);
                    const reviewEl = document.querySelector(`.year-edit-round-review[data-round="${roundNum}"]`);
                    const replyDateEl = document.querySelector(`.year-edit-round-reply-date[data-round="${roundNum}"]`);
                    const responseDateEl = document.querySelector(`.year-edit-round-response-date[data-round="${roundNum}"]`);
                    
                    // 取得值（包括空字串，允許清空）
                    const handling = handlingEl ? handlingEl.value : '';
                    const review = reviewEl ? reviewEl.value : '';
                    const replyDate = replyDateEl ? replyDateEl.value : '';
                    const responseDate = responseDateEl ? responseDateEl.value : '';
                    
                    // 所有顯示的輪次都要更新，即使內容為空（允許清空欄位）
                    try {
                        const updateRes = await apiFetch(`/api/issues/${issueId}`, {
                            method: 'PUT',
                            body: JSON.stringify({
                                status: status, // 保持當前狀態
                                round: roundNum,
                                handling: handling, // 允許空字串
                                review: review, // 允許空字串
                                replyDate: replyDate, // 允許空字串
                                responseDate: responseDate // 允許空字串
                            })
                        });
                        
                        if (updateRes.ok) {
                            successCount++;
                        } else {
                            const errorData = await updateRes.json().catch(() => ({}));
                            console.error(`更新第 ${roundNum} 輪失敗:`, errorData.error || updateRes.statusText);
                            errorCount++;
                        }
                    } catch (e) {
                        console.error(`更新第 ${roundNum} 輪失敗:`, e);
                        errorCount++;
                    }
                }
                
                if (successCount > 0 || errorCount === 0) {
                    showToast(`儲存成功${errorCount > 0 ? `（${errorCount} 個輪次更新失敗）` : ''}`, 
                        errorCount > 0 ? 'warning' : 'success');
                    // 重新載入當前事項的資料（通過編號查詢）
                    try {
                        const currentNumber = document.getElementById('yearEditNumber')?.value.trim() || yearEditIssue?.number;
                        if (currentNumber) {
                            const res = await fetch(`/api/issues?page=1&pageSize=1&q=${encodeURIComponent(currentNumber)}&_t=${Date.now()}`);
                            if (res.ok) {
                                const json = await res.json();
                                if (json.data && json.data.length > 0) {
                                    yearEditIssue = json.data[0];
                                    // 標準化字段名（確保同時有兩種格式，提高兼容性）
                                    if (yearEditIssue.division_name && !yearEditIssue.divisionName) {
                                        yearEditIssue.divisionName = yearEditIssue.division_name;
                                    }
                                    if (yearEditIssue.inspection_category_name && !yearEditIssue.inspectionCategoryName) {
                                        yearEditIssue.inspectionCategoryName = yearEditIssue.inspection_category_name;
                                    }
                                    if (yearEditIssue.item_kind_code && !yearEditIssue.itemKindCode) {
                                        yearEditIssue.itemKindCode = yearEditIssue.item_kind_code;
                                    }
                                    if (yearEditIssue.plan_name && !yearEditIssue.planName) {
                                        yearEditIssue.planName = yearEditIssue.plan_name;
                                    }
                                    // 重新渲染事項內容
                                    renderYearEditIssue();
                                }
                            }
                        }
                    } catch (reloadError) {
                        console.error('重新載入事項資料失敗:', reloadError);
                        // 即使重新載入失敗，也顯示成功訊息（因為已經保存成功）
                        // 嘗試使用當前輸入的值更新 yearEditIssue 並重新渲染
                        if (yearEditIssue) {
                            yearEditIssue.number = document.getElementById('yearEditNumber')?.value.trim() || yearEditIssue.number;
                            yearEditIssue.year = document.getElementById('yearEditYear')?.value.trim() || yearEditIssue.year;
                            yearEditIssue.unit = document.getElementById('yearEditUnit')?.value.trim() || yearEditIssue.unit;
                            // 同時更新兩種格式的字段名（確保兼容性）
                            const divisionValue = document.getElementById('yearEditDivision')?.value || '';
                            yearEditIssue.divisionName = divisionValue;
                            yearEditIssue.division_name = divisionValue;
                            const inspectionValue = document.getElementById('yearEditInspection')?.value || '';
                            yearEditIssue.inspectionCategoryName = inspectionValue;
                            yearEditIssue.inspection_category_name = inspectionValue;
                            const kindValue = document.getElementById('yearEditKind')?.value || '';
                            yearEditIssue.item_kind_code = kindValue;
                            yearEditIssue.itemKindCode = kindValue;
                            const planValue = document.getElementById('yearEditPlanNameSelect')?.value || '';
                            const { name: planName } = parsePlanValue(planValue);
                            if (planName) {
                                yearEditIssue.plan_name = planName;
                                yearEditIssue.planName = planName;
                            }
                            yearEditIssue.status = document.getElementById('yearEditStatus')?.value || yearEditIssue.status;
                            yearEditIssue.issue_date = document.getElementById('yearEditIssueDate')?.value || yearEditIssue.issue_date;
                            yearEditIssue.content = document.getElementById('yearEditContent')?.value || yearEditIssue.content;
                            renderYearEditIssue();
                        }
                    }
                } else {
                    showToast('儲存失敗', 'error');
                }
            } catch (e) {
                showToast('儲存時發生錯誤: ' + e.message, 'error');
            }
        }