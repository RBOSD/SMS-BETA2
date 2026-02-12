function validatePassword(password) {
    if (!password || typeof password !== 'string') {
        return { valid: false, message: '密碼不能為空' };
    }
    
    if (password.length < 8) {
        return { valid: false, message: '密碼至少需要 8 個字元' };
    }
    
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: '密碼必須包含至少一個大寫字母' };
    }
    
    if (!/[a-z]/.test(password)) {
        return { valid: false, message: '密碼必須包含至少一個小寫字母' };
    }
    
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: '密碼必須包含至少一個數字' };
    }
    
    return { valid: true };
}

module.exports = { validatePassword };
