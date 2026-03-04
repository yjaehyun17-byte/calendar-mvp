import { promises as fs } from "fs";
import path from "path";
import bundledMaster from "../../data/krx-master.json";

export type CompanyMasterItem = {
  name: string;
  ticker: string;
  market: "KOSPI" | "KOSDAQ" | "KRX";
};

type RawMasterItem = {
  name?: string;
  ticker?: string;
  market?: string;
};

const MASTER_PATH = path.join(process.cwd(), "data", "krx-master.json");
const ALLOWED_MARKETS = new Set(["KOSPI", "KOSDAQ", "KRX"]);

function normalizeMarket(market?: string): CompanyMasterItem["market"] | null {
  if (!market) return null;
  const normalized = market.toUpperCase();
  if (!ALLOWED_MARKETS.has(normalized)) return null;
  return normalized as CompanyMasterItem["market"];
}

function normalizeTicker(value?: string): string | null {
  if (!value) return null;
  const digitsOnly = value.replace(/\D/g, "");
  if (digitsOnly.length !== 6) return null;
  return digitsOnly;
}

function normalizeItem(item: RawMasterItem): CompanyMasterItem | null {
  const name = item.name?.trim();
  const ticker = normalizeTicker(item.ticker);
  const market = normalizeMarket(item.market);

  if (!name || !ticker || !market) {
    return null;
  }

  return { name, ticker, market };
}

export async function loadCompanyMaster(): Promise<CompanyMasterItem[]> {
  const normalizeList = (rows: RawMasterItem[]) =>
    rows
      .map((item) => normalizeItem(item))
      .filter((item): item is CompanyMasterItem => item !== null);

  try {
    const raw = await fs.readFile(MASTER_PATH, "utf-8");
    const parsed = JSON.parse(raw) as RawMasterItem[];
    const normalized = normalizeList(parsed);
    if (normalized.length > 0) {
      return normalized;
    }
  } catch {
    // noop: fallback to bundled master below
  }

  return normalizeList(bundledMaster as RawMasterItem[]);
}

export function searchCompanyMaster(
  companies: CompanyMasterItem[],
  query: string,
): CompanyMasterItem[] {
  const keyword = query.trim().toLowerCase();
  const compactKeyword = keyword.replace(/\s+/g, "");

  if (keyword.length < 1) {
    return [];
  }

  return companies
    .filter((company) => {
      const normalizedName = company.name.toLowerCase();
      const compactName = normalizedName.replace(/\s+/g, "");

      return (
        normalizedName.includes(keyword) ||
        compactName.includes(compactKeyword) ||
        company.ticker.includes(keyword)
      );
    })
    .slice(0, 20);
}
