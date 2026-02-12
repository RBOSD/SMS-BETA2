/**
 * API 封裝：CSRF、apiFetch、credentials
 */
let csrfToken = null;

export async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  try {
    const res = await fetch('/api/csrf-token', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      csrfToken = data.csrfToken;
      return csrfToken;
    }
  } catch (e) {
    console.error('Failed to get CSRF token:', e);
  }
  return null;
}

export async function apiFetch(url, options = {}) {
  const needsCsrf = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method);
  const headers = { ...options.headers };
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  } else if (!headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (needsCsrf) {
    const token = await getCsrfToken();
    if (!token) throw new Error('無法取得 CSRF token，請重新整理頁面');
    headers['X-CSRF-Token'] = token;
  }
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });
  if (response.status === 401) {
    sessionStorage.clear();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (response.status === 403 && needsCsrf) {
    const errorData = await response.json().catch(() => ({}));
    if (errorData.error && errorData.error.includes('CSRF')) {
      csrfToken = null;
      const newToken = await getCsrfToken();
      if (newToken) {
        headers['X-CSRF-Token'] = newToken;
        const retry = await fetch(url, { ...options, credentials: 'include', headers });
        if (retry.ok || retry.status !== 403) return retry;
      }
    }
  }
  return response;
}
