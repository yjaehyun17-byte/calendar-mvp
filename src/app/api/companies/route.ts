import { NextResponse } from "next/server";

type NormalizedCompany = {
  name: string;
  ticker: string;
  market: "KOSPI" | "KOSDAQ" | "KRX";
  googleFinanceUrl: string;
};

type LooseGoogleFinanceMatchItem = Record<string, unknown>;

type LooseGoogleFinanceMatchResponse = {
  matches?: LooseGoogleFinanceMatchItem[];
};

const SUPPORTED_MARKETS = new Set(["KRX", "KOSPI", "KOSDAQ"]);

function normalizeMarket(value: string): NormalizedCompany["market"] | null {
  const normalized = value.toUpperCase();
  if (!SUPPORTED_MARKETS.has(normalized)) return null;
  return normalized as NormalizedCompany["market"];
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

function normalizeMatch(item: LooseGoogleFinanceMatchItem): NormalizedCompany | null {
  const ticker = pickString(item.t, item.ticker, item.symbol);
  const name = pickString(item.n, item.name, item.companyName);
  const marketRaw = pickString(item.e, item.exchange, item.market);

  if (!ticker || !name || !marketRaw) {
    return null;
  }

  const market = normalizeMarket(marketRaw);
  if (!market) {
    return null;
  }

  return {
    name,
    ticker,
    market,
    googleFinanceUrl: buildGoogleFinanceUrl(ticker),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

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

    if (!response.ok) {
      return NextResponse.json([]);
    }

    const rawBody = await response.text();
    const parsed = parseMatchPayload(rawBody);
    const matches = parsed?.matches ?? [];

    const results = matches
      .map((item) => normalizeMatch(item))
      .filter((item): item is NormalizedCompany => item !== null)
      .filter(
        (item, index, array) =>
          array.findIndex((candidate) => candidate.ticker === item.ticker) === index,
      )
      .slice(0, 20);

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
