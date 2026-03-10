import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SOURCE_URL = process.env.KRX_MASTER_SOURCE_URL;
const DATA_GO_KR_API_URL = process.env.DATA_GO_KR_API_URL;
const DATA_GO_KR_SERVICE_KEY = process.env.DATA_GO_KR_SERVICE_KEY;

if (!SOURCE_URL && !(DATA_GO_KR_API_URL && DATA_GO_KR_SERVICE_KEY)) {
  console.error(
    'KRX_MASTER_SOURCE_URL 또는 DATA_GO_KR_API_URL + DATA_GO_KR_SERVICE_KEY 환경변수가 필요합니다.',
  );
  process.exit(1);
}

function normalizeHeader(value) {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function parseCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(',')
    .map((h) => normalizeHeader(h.replace(/^"|"$/g, '')));

  return lines.slice(1).map((line) => {
    const columns = line.split(',').map((v) => v.replace(/^"|"$/g, '').trim());
    const row = {};

    headers.forEach((header, index) => {
      row[header] = columns[index] ?? '';
    });

    return row;
  });
}


function normalizeRowKeys(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;

  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      normalizeHeader(String(key)),
      typeof value === 'string' ? value.trim() : value,
    ]),
  );
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

  if (
    normalized.includes('KOSPI') ||
    normalized.includes('유가증권') ||
    normalized.includes('코스피')
  ) {
    return 'KOSPI';
  }

  if (normalized.includes('KOSDAQ') || normalized.includes('코스닥')) {
    return 'KOSDAQ';
  }

  if (normalized === 'KRX') return 'KRX';

  return null;
}

function normalizeTicker(value) {
  if (!value) return null;
  const cleaned = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleaned || cleaned.length > 20) return null;
  // 숫자만 있는 경우 6자리 zero-pad (기존 한국 종목코드)
  if (/^[0-9]+$/.test(cleaned)) return cleaned.padStart(6, '0').slice(-6);
  // 영문 포함(영문 티커, 혼합 코드)은 그대로
  return cleaned;
}

function normalizeRows(rows) {
  return rows
    .map((row) => {
      const name = pickValue(row, [
        'name',
        'company_name',
        '종목명',
        '회사명',
        'itmsnm',
        'corpnm',
      ]);
      const ticker = normalizeTicker(
        pickValue(row, [
          'ticker',
          'code',
          'stock_code',
          '단축코드',
          '종목코드',
          'srtncd',
          'stck_shrn_iscd',
        ]),
      );
      const market = normalizeMarket(
        pickValue(row, ['market', '시장구분', 'market_type', '시장', 'mrktctg']),
      );

      if (!name || !ticker || !market) return null;

      return { name, ticker, market };
    })
    .filter(Boolean)
    .filter((item, index, arr) => arr.findIndex((c) => c.ticker === item.ticker) === index)
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

function flattenObjects(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenObjects(item));
  }

  if (value && typeof value === 'object') {
    const asObject = value;
    const values = Object.values(asObject);
    const nested = values.flatMap((item) => flattenObjects(item));

    const looksLikeRow = values.some((item) => typeof item === 'string');
    return looksLikeRow ? [asObject, ...nested] : nested;
  }

  return [];
}

function parseJsonRows(parsed) {
  if (Array.isArray(parsed)) return parsed;

  if (!parsed || typeof parsed !== 'object') return [];

  if (Array.isArray(parsed.items)) return parsed.items;
  if (parsed.items && typeof parsed.items === 'object' && Array.isArray(parsed.items.item)) {
    return parsed.items.item;
  }

  if (
    parsed.response &&
    typeof parsed.response === 'object' &&
    parsed.response.body &&
    typeof parsed.response.body === 'object'
  ) {
    const body = parsed.response.body;
    if (Array.isArray(body.items)) return body.items;
    if (body.items && typeof body.items === 'object' && Array.isArray(body.items.item)) {
      return body.items.item;
    }
  }

  return flattenObjects(parsed);
}

async function fetchFromUrl(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    console.error(`상장사 마스터 다운로드 실패: ${response.status}`);
    process.exit(1);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();

  if (contentType.includes('application/json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
    const parsed = JSON.parse(text);
    return parseJsonRows(parsed);
  }

  return parseCsv(text);
}

async function fetchFromDataGoKr() {
  const pageSize = Number(process.env.DATA_GO_KR_PAGE_SIZE ?? '500');
  const maxPages = Number(process.env.DATA_GO_KR_MAX_PAGES ?? '20');
  const dataType = process.env.DATA_GO_KR_DATA_TYPE ?? 'json';

  const rows = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL(DATA_GO_KR_API_URL);
    url.searchParams.set('serviceKey', DATA_GO_KR_SERVICE_KEY);
    url.searchParams.set('numOfRows', String(pageSize));
    url.searchParams.set('pageNo', String(page));
    url.searchParams.set('resultType', dataType);

    const pageRows = await fetchFromUrl(url.toString());
    if (pageRows.length === 0) break;

    rows.push(...pageRows);

    if (pageRows.length < pageSize) break;
  }

  return rows;
}

const rawRows = SOURCE_URL ? await fetchFromUrl(SOURCE_URL) : await fetchFromDataGoKr();
const normalizedRows = rawRows.map((row) => normalizeRowKeys(row));

const normalized = normalizeRows(normalizedRows);
const outputPath = path.join(process.cwd(), 'data', 'krx-master.json');

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(normalized, null, 2), 'utf-8');

console.log(`Saved ${normalized.length} companies -> ${outputPath}`);
