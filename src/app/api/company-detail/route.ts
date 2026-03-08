import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/serverSupabase";

type YahooChartResult = {
  meta: { marketCap?: number };
  timestamp: number[];
  indicators: { quote: Array<{ close: (number | null)[] }> };
};

type NaverTitleItem = { isConsensus: string; title: string; key: string };
type NaverColumnItem = { value: string; cx: string | null };
type NaverRowItem = { title: string; columns: Record<string, NaverColumnItem> };
type NaverFinanceInfo = { trTitleList: NaverTitleItem[]; rowList: NaverRowItem[] };
type NaverFinanceResponse = { financeInfo: NaverFinanceInfo };

async function safeFetch(url: string, extraHeaders?: Record<string, string>) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", ...extraHeaders },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function parseNaverValue(row: NaverRowItem | undefined, key: string, multiplyOk: number): number | null {
  if (!row) return null;
  const col = row.columns[key];
  if (!col) return null;
  const v = String(col.value).replace(/,/g, "").trim();
  if (v === "-" || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n * multiplyOk;
}

function parseNaverFinanceData(data: unknown, onlyConfirmed: boolean) {
  if (!data || typeof data !== "object") return [];
  const resp = data as NaverFinanceResponse;
  const fi = resp.financeInfo;
  if (!fi?.trTitleList || !fi?.rowList) return [];

  const periods = fi.trTitleList.filter((t) =>
    onlyConfirmed ? t.isConsensus === "N" : true
  );

  const findRow = (title: string) => fi.rowList.find((r) => r.title === title);
  const revenueRow = findRow("매출액");
  const opIncomeRow = findRow("영업이익");
  const netIncomeRow = findRow("당기순이익");
  const epsRow = findRow("EPS");

  return periods.map((p) => ({
    // Use title as display period (e.g. "2023.12." or "2024.03.")
    period: p.title.replace(/\.$/, ""),
    revenue: parseNaverValue(revenueRow, p.key, 100_000_000),
    operatingIncome: parseNaverValue(opIncomeRow, p.key, 100_000_000),
    netIncome: parseNaverValue(netIncomeRow, p.key, 100_000_000),
    eps: parseNaverValue(epsRow, p.key, 1),
  }));
}

const PERIOD_CONFIG: Record<string, { interval: string; lookbackDays: number }> = {
  "1d":  { interval: "1d",  lookbackDays: 30 },
  "1wk": { interval: "1wk", lookbackDays: 180 },
  "1mo": { interval: "1mo", lookbackDays: 730 },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.trim();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const period = searchParams.get("period") ?? "1d";
  const { interval, lookbackDays } = PERIOD_CONFIG[period] ?? PERIOD_CONFIG["1d"];

  const supabase = getServerSupabaseClient();
  const { data: company } = supabase
    ? await supabase.from("companies_krx").select("name_kr,market").eq("ticker", ticker).maybeSingle()
    : { data: null };

  const suffix = company?.market === "KOSDAQ" ? ".KQ" : ".KS";
  const yahooTicker = `${ticker}${suffix}`;
  const naverHeaders = { Referer: "https://m.stock.naver.com/" };

  const now = Math.floor(Date.now() / 1000);
  const periodStart = now - lookbackDays * 24 * 3600;

  const [chartData, quoteData, annualData, quarterData] = await Promise.all([
    safeFetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=${interval}&period1=${periodStart}&period2=${now}`
    ),
    safeFetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooTicker}`),
    safeFetch(`https://m.stock.naver.com/api/stock/${ticker}/finance/annual`, naverHeaders),
    safeFetch(`https://m.stock.naver.com/api/stock/${ticker}/finance/quarter`, naverHeaders),
  ]);

  // Price chart
  const chartResult: YahooChartResult | undefined = chartData?.chart?.result?.[0];
  const priceHistory: { date: string; close: number }[] = [];
  if (chartResult) {
    const closes = chartResult.indicators.quote[0].close;
    chartResult.timestamp.forEach((ts, i) => {
      const c = closes[i];
      if (c !== null && c > 0) {
        priceHistory.push({ date: new Date(ts * 1000).toISOString().slice(0, 10), close: Math.round(c) });
      }
    });
  }

  const currentPrice = priceHistory.at(-1)?.close ?? null;
  const prevPrice = priceHistory.at(-2)?.close ?? null;
  const changePct = currentPrice && prevPrice ? ((currentPrice - prevPrice) / prevPrice) * 100 : null;
  const marketCap =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (quoteData?.quoteResponse?.result?.[0]?.marketCap as number | undefined) ??
    chartResult?.meta?.marketCap ??
    null;

  return NextResponse.json({
    companyName: company?.name_kr ?? ticker,
    ticker,
    market: company?.market ?? "KRX",
    currentPrice,
    changePct,
    marketCap,
    priceHistory,
    annualFinancials: parseNaverFinanceData(annualData, true),
    quarterlyFinancials: parseNaverFinanceData(quarterData, true),
  });
}
