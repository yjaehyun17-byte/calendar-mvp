import { NextResponse } from "next/server";
import { loadCompanyMaster, searchCompanyMaster } from "@/lib/companyMaster";

type CompanyResult = {
  name: string;
  ticker: string;
  market: "KOSPI" | "KOSDAQ" | "KRX";
  googleFinanceUrl: string;
  source: "master" | "google_finance";
};

type LooseGoogleFinanceMatchItem = Record<string, unknown>;

type LooseGoogleFinanceMatchResponse = {
  matches?: LooseGoogleFinanceMatchItem[];
};

const SUPPORTED_MARKETS = new Set(["KRX", "KOSPI", "KOSDAQ"]);

function normalizeMarket(value: string): CompanyResult["market"] | null {
  const normalized = value.toUpperCase();
  if (!SUPPORTED_MARKETS.has(normalized)) return null;
  return normalized as CompanyResult["market"];
}

function buildGoogleFinanceUrl(ticker: string) {
  return `https://www.google.com/finance/quote/${ticker}:KRX`;
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function parseMatchPayload(payload: string): LooseGoogleFinanceMatchResponse | null {
  const text = payload.trim();
  if (!text) return null;

  const normalized = text.startsWith(")]}'") ? text.replace(/^\)\]\}'\s*/, "") : text;

  try {
    return JSON.parse(normalized) as LooseGoogleFinanceMatchResponse;
  } catch {
    return null;
  }
}

function normalizeGoogleMatch(item: LooseGoogleFinanceMatchItem): CompanyResult | null {
  const ticker = pickString(item.t, item.ticker, item.symbol)?.replace(/\D/g, "");
  const name = pickString(item.n, item.name, item.companyName);
  const marketRaw = pickString(item.e, item.exchange, item.market);

  if (!ticker || ticker.length !== 6 || !name || !marketRaw) {
    return null;
  }

  const market = normalizeMarket(marketRaw);
  if (!market) return null;

  return {
    name,
    ticker,
    market,
    googleFinanceUrl: buildGoogleFinanceUrl(ticker),
    source: "google_finance",
  };
}

async function fetchGoogleFinanceMatches(query: string): Promise<CompanyResult[]> {
  try {
    const response = await fetch(
      `https://www.google.com/finance/match?matchtype=matchall&q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "application/json,text/plain,*/*",
          "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
          Referer: "https://www.google.com/finance/",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) return [];

    const rawBody = await response.text();
    const parsed = parseMatchPayload(rawBody);
    const matches = parsed?.matches ?? [];

    return matches
      .map((item) => normalizeGoogleMatch(item))
      .filter((item): item is CompanyResult => item !== null)
      .filter(
        (item, index, array) =>
          array.findIndex((candidate) => candidate.ticker === item.ticker) === index,
      )
      .slice(0, 20);
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  const masterCompanies = searchCompanyMaster(await loadCompanyMaster(), query).map(
    (company) => ({
      ...company,
      googleFinanceUrl: buildGoogleFinanceUrl(company.ticker),
      source: "master" as const,
    }),
  );

  if (masterCompanies.length > 0) {
    return NextResponse.json(masterCompanies);
  }

  const googleMatches = await fetchGoogleFinanceMatches(query);
  return NextResponse.json(googleMatches);
}
