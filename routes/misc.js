const { GoogleGenerativeAI } = require("@google/generative-ai");
const { requireAuth } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
const { geminiLimiter } = require('../middleware/rateLimit');
const { logError } = require('../utils/log');
const { writeToLogFile } = require('../utils/log');

module.exports = function registerMiscRoutes(app, { csrfProtection }) {
    app.get('/api/csrf-token', (req, res) => {
        if (!req.session.csrfSecret) {
            req.session.csrfSecret = csrfProtection.secretSync();
        }
        const token = csrfProtection.create(req.session.csrfSecret);
        res.json({ csrfToken: token });
    });

    app.post('/api/log', requireAuth, verifyCsrf, (req, res) => {
        try {
            const { message, level = 'INFO' } = req.body;
            if (message) {
                writeToLogFile(message, level);
                res.json({ success: true });
            } else {
                res.status(400).json({ error: 'Message is required' });
            }
        } catch (e) {
            console.error("Log API error:", e);
            logError(e, 'Log API error', req).catch(() => {});
            res.status(500).json({ error: 'Failed to write log' });
        }
    });

    app.post('/api/gemini', geminiLimiter, async (req, res) => {
        const { content, rounds } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: '後端未設定 GEMINI_API_KEY' });
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const latestRound = (rounds && rounds.length > 0) ? rounds[rounds.length - 1] : { handling: '無', review: '無' };
            const previousReview = (rounds && rounds.length > 1) ? rounds[rounds.length - 2].review : '無';
            const prompt = `
        你現在是【鐵道監理機關】的專業審查人員，正在審核受檢機構針對缺失事項的改善情形。
        請秉持「中立、客觀、平實」的原則進行審查。
        【待改善事項內容】：${content}
        【上一回合審查意見】：${previousReview}
        【本次機構辦理情形】：${latestRound.handling || '無'}
        【回覆格式要求】：JSON: {"fulfill": "Yes/No", "result": "100字內簡評"}
        `;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
            try {
                const json = JSON.parse(text);
                res.json(json);
            } catch (parseError) {
                res.json({ fulfill: text.includes("Yes") ? "Yes" : "No", reason: text.replace(/[{}]/g, '').trim() });
            }
        } catch (e) {
            console.error("Gemini API Error:", e);
            res.status(500).json({ error: 'AI 分析失敗: ' + e.message });
        }
    });
};
