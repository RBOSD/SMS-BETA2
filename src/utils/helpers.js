/**
 * 工具函數：stripHtml、getKindLabel、getLatestReviewOrHandling、extractKindCodeFromNumber
 */

export function stripHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = String(html);
  return (div.textContent || div.innerText || '').trim();
}

export function extractKindCodeFromNumber(numberStr) {
  if (!numberStr) return null;
  const m = String(numberStr).match(/-([NOR])\d+$/i);
  return m ? m[1].toUpperCase() : null;
}

export function getKindLabel(kindCode) {
  if (!kindCode) return null;
  const map = { N: '缺失', O: '觀察', R: '建議' };
  const label = map[kindCode] || '';
  return label ? { tag: kindCode, label } : null;
}

export function getLatestReviewOrHandling(item) {
  let latestReviewRound = 0;
  let latestHandlingRound = 0;
  let latestReview = null;
  let latestHandling = null;
  for (let k = 200; k >= 1; k--) {
    const rKey = k === 1 ? 'review' : `review${k}`;
    if (item[rKey] && String(item[rKey]).trim()) {
      latestReviewRound = k;
      latestReview = item[rKey];
      break;
    }
  }
  for (let k = 200; k >= 1; k--) {
    const hKey = k === 1 ? 'handling' : `handling${k}`;
    if (item[hKey] && String(item[hKey]).trim()) {
      latestHandlingRound = k;
      latestHandling = item[hKey];
      break;
    }
  }
  if (latestReviewRound > latestHandlingRound) {
    return { type: 'review', content: latestReview, round: latestReviewRound };
  }
  if (latestHandlingRound > latestReviewRound) {
    return { type: 'handling', content: latestHandling, round: latestHandlingRound };
  }
  if (latestReviewRound > 0 && latestReviewRound === latestHandlingRound) {
    return { type: 'review', content: latestReview, round: latestReviewRound };
  }
  if (latestReview) return { type: 'review', content: latestReview, round: latestReviewRound };
  if (latestHandling) return { type: 'handling', content: latestHandling, round: latestHandlingRound };
  return null;
}

export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
