import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SOURCE_URL = process.env.KRX_MASTER_SOURCE_URL;

if (!SOURCE_URL) {
  console.error('KRX_MASTER_SOURCE_URL 환경변수가 필요합니다.');
  process.exit(1);
}

function normalizeHeader(value) {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function parseCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => normalizeHeader(h.replace(/^"|"$/g, '')));

  return lines.slice(1).map((line) => {
    const columns = line.split(',').map((v) => v.replace(/^"|"$/g, '').trim());
    const row = {};

    headers.forEach((header, index) => {
      row[header] = columns[index] ?? '';
    });

    return row;
  });
}

function pickValue(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function normalizeMarket(value) {
  if (!value) return null;
  const normalized = value.toUpperCase();

  if (normalized.includes('KOSPI') || normalized.includes('유가증권') || normalized.includes('코스피')) return 'KOSPI';
  if (normalized.includes('KOSDAQ') || normalized.includes('코스닥')) return 'KOSDAQ';
  if (normalized === 'KRX') return 'KRX';

  return null;
}

function normalizeTicker(value) {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length === 6 ? digits : null;
}

function normalizeRows(rows) {
  return rows
    .map((row) => {
      const name = pickValue(row, ['name', 'company_name', '종목명', '회사명']);
      const ticker = normalizeTicker(pickValue(row, ['ticker', 'code', 'stock_code', '단축코드', '종목코드']));
      const market = normalizeMarket(pickValue(row, ['market', '시장구분', 'market_type', '시장']));

      if (!name || !ticker || !market) return null;

      return { name, ticker, market };
    })
    .filter(Boolean)
    .filter((item, index, arr) => arr.findIndex((c) => c.ticker === item.ticker) === index)
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

const response = await fetch(SOURCE_URL, { cache: 'no-store' });
if (!response.ok) {
  console.error(`상장사 마스터 다운로드 실패: ${response.status}`);
  process.exit(1);
}

const contentType = response.headers.get('content-type') ?? '';
const text = await response.text();

let rows;
if (contentType.includes('application/json') || text.trim().startsWith('[')) {
  rows = JSON.parse(text);
} else {
  rows = parseCsv(text);
}

const normalized = normalizeRows(rows);
const outputPath = path.join(process.cwd(), 'data', 'krx-master.json');

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(normalized, null, 2), 'utf-8');

console.log(`Saved ${normalized.length} companies -> ${outputPath}`);
