/**
 * 編號解析工具：parseItemNumber、ORG_MAP、DIVISION_MAP、INSPECTION_MAP、KIND_MAP
 * 與 public/scripts.js 保持一致
 */

function normalizeCodeString(str) {
  if (!str) return '';
  let s = String(str);
  if (s.normalize) s = s.normalize('NFKC');
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
  s = s.replace(/[\u2010-\u2015\u2212\uFE63\uFF0D]/g, '-');
  s = s.replace(/[ \t]+/g, ' ').replace(/\s*-\s*/g, '-');
  return s.trim();
}

export const ORG_MAP = {
  T: '臺鐵',
  H: '高鐵',
  A: '林鐵',
  S: '糖鐵',
  TRC: '臺鐵',
  HSR: '高鐵',
  AFR: '林鐵',
  TSC: '糖鐵',
};

export const DIVISION_MAP = {
  A: '運務',
  B: '工務',
  C: '機務',
  D: '電務',
  E: '安全',
  F: '審核',
  G: '災防',
  OP: '運轉',
  CV: '土建',
  ME: '機務',
  EL: '電務',
  SM: '安全管理',
  AD: '營運',
  OT: '其他',
  CP: '土木',
  EM: '機電',
};

export const INSPECTION_MAP = {
  '1': '定期檢查',
  '2': '例行性檢查',
  '3': '特別檢查',
  '4': '臨時檢查',
  '5': '調查',
};

export const KIND_MAP = {
  N: '缺失事項',
  O: '觀察事項',
  R: '建議事項',
};

export function parseItemNumber(numberStr) {
  const raw = normalizeCodeString(numberStr || '');
  if (!raw) return null;

  let m = raw.match(/^(\d{2})([THAS])([1-4])\-([A-G])(\d{2})\-([NOR])(\d{2})$/i);
  if (m) {
    const yy = parseInt(m[1], 10);
    const rocYear = 100 + yy;
    return {
      scheme: 'THAS-v1',
      raw,
      yearRoc: rocYear,
      orgCode: m[2].toUpperCase(),
      orgCodeRaw: m[2].toUpperCase(),
      inspectCode: m[3],
      divCode: m[4].toUpperCase(),
      divisionCode: m[4].toUpperCase(),
      kindCode: m[6].toUpperCase(),
    };
  }

  m = raw.match(/^(\d{3})-([A-Z]{3})-([1-4])-(\d+)-([A-Z]{2,3})-([NOR])(\d{1,3})$/i);
  if (m) {
    return {
      scheme: 'TRC-v2',
      raw,
      yearRoc: parseInt(m[1], 10),
      orgCode: m[2].toUpperCase(),
      orgCodeRaw: m[2].toUpperCase(),
      inspectCode: m[3],
      divCode: m[5].toUpperCase(),
      divisionCode: m[5].toUpperCase(),
      kindCode: m[6].toUpperCase(),
    };
  }

  m = raw.match(/^(\d{3})([THAS])([1-5])\-(\d{2})\-([A-Z]{2,3})\-([NOR])(\d{2})$/i);
  if (m) {
    return {
      scheme: 'THAS-v2',
      raw,
      yearRoc: parseInt(m[1], 10),
      orgCode: m[2].toUpperCase(),
      orgCodeRaw: m[2].toUpperCase(),
      inspectCode: m[3],
      divCode: m[5].toUpperCase(),
      divisionCode: m[5].toUpperCase(),
      kindCode: m[6].toUpperCase(),
    };
  }

  m = raw.match(/^(\d{3})([THAS])([1-5])(\d{2})([A-Z]{2,3})([NOR])(\d{2})$/i);
  if (m) {
    return {
      scheme: 'THAS-v2',
      raw,
      yearRoc: parseInt(m[1], 10),
      orgCode: m[2].toUpperCase(),
      orgCodeRaw: m[2].toUpperCase(),
      inspectCode: m[3],
      divCode: m[5].toUpperCase(),
      divisionCode: m[5].toUpperCase(),
      kindCode: m[6].toUpperCase(),
    };
  }

  m = raw.match(/^(\d{3})([THAS])([1-5])\-(\d{2})\-([A-Z]{2,3})\-(\d{2,3})$/i);
  if (m) {
    return {
      scheme: 'THAS-v2',
      raw,
      yearRoc: parseInt(m[1], 10),
      orgCode: m[2].toUpperCase(),
      orgCodeRaw: m[2].toUpperCase(),
      inspectCode: m[3],
      divCode: m[5].toUpperCase(),
      divisionCode: m[5].toUpperCase(),
      kindCode: '',
    };
  }

  return null;
}
