const path = require('path');
const fs = require('fs');
const { pool } = require('../config/pool');

async function logAction(username, action, details, req) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    try {
        if (action === 'LOGIN') {
            await pool.query("INSERT INTO logs (username, action, details, ip_address, login_time, created_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", 
                [username, action, details, ip]);
        } else {
            await pool.query("INSERT INTO logs (username, action, details, ip_address, created_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)", 
                [username, action, details, ip]);
        }
    } catch (e) { 
        console.error("Log error:", e);
        writeToLogFile(`Error logging action: ${e.message}`, 'ERROR');
    }
}

async function logError(error, context, req) {
    try {
        const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : 'system';
        const username = req?.session?.user?.username || 'system';
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : '';
        const details = `${context}: ${errorMessage}${errorStack ? `\nStack: ${errorStack.substring(0, 500)}` : ''}`;
        
        try {
            await pool.query(
                "INSERT INTO logs (username, action, details, ip_address, created_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)",
                [username, 'ERROR', details, ip]
            );
        } catch (dbError) {
            console.error("Failed to log error to database:", dbError);
        }
        
        writeToLogFile(`[ERROR] ${context}: ${errorMessage}`, 'ERROR');
    } catch (e) {
        console.error("Failed to log error:", e);
        console.error("Original error:", error);
    }
}

function writeToLogFile(message, level = 'INFO') {
    try {
        const logDir = path.join(__dirname, '..', 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        const today = new Date().toISOString().split('T')[0];
        const logFile = path.join(logDir, `app-${today}.log`);
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}\n`;
        fs.appendFileSync(logFile, logEntry, 'utf8');
    } catch (e) {
        console.error("Write log file error:", e);
    }
}

function cleanupOldLogs() {
    try {
        const logDir = path.join(__dirname, '..', 'logs');
        if (!fs.existsSync(logDir)) {
            return;
        }
        
        const maxAge = 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        
        fs.readdir(logDir, (err, files) => {
            if (err) {
                console.error('Error reading log directory:', err);
                return;
            }
            
            files.forEach(file => {
                if (!file.startsWith('app-') || !file.endsWith('.log')) {
                    return;
                }
                
                const filePath = path.join(logDir, file);
                fs.stat(filePath, (err, stats) => {
                    if (err) return;
                    const fileAge = now - stats.mtime.getTime();
                    if (fileAge > maxAge) {
                        fs.unlink(filePath, (err) => {
                            if (err) console.error(`Error deleting old log file ${file}:`, err);
                            else console.log(`Deleted old log file: ${file}`);
                        });
                    }
                });
            });
        });
    } catch (e) {
        console.error('Error in cleanupOldLogs:', e);
    }
}

module.exports = {
    logAction,
    logError,
    writeToLogFile,
    cleanupOldLogs,
};
