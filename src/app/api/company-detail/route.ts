import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/serverSupabase";

type YahooChartResult = {
  timestamp: number[];
  indicators: { quote: Array<{ close: (number | null)[] }> };
};

type NaverFinancialItem = {
  [key: string]: string | number | null;
};

async function safeFetch(url: string, extraHeaders?: Record<string, string>) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", ...extraHeaders },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  return res.json();
}

function parseNaverNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/,/g, "").trim();
  if (cleaned === "-" || cleaned === "") return null;
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

async function fetchNaverFinancials(ticker: string) {
  const naverHeaders = { "Referer": "https://m.stock.naver.com/" };
  const [annualData, quarterData] = await Promise.all([
    safeFetch(`https://m.stock.naver.com/api/stock/${ticker}/finance/annual`, naverHeaders),
    safeFetch(`https://m.stock.naver.com/api/stock/${ticker}/finance/quarter`, naverHeaders),
  ]);

  function parseRows(data: unknown, isQuarter: boolean) {
    // Handle both array response and { financeInfo: [...] } wrapper
    let rows: NaverFinancialItem[] = [];
    if (Array.isArray(data)) {
      rows = data as NaverFinancialItem[];
    } else if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      const fin = obj.financeInfo ?? obj.finance ?? obj.data;
      if (Array.isArray(fin)) rows = fin as NaverFinancialItem[];
    }
    return rows.map((item) => {
      const rawPeriod = String(item.stacYymm ?? item.stacYm ?? item.yyyyMm ?? "").replace("/", "-");
      return {
        period: isQuarter ? rawPeriod.slice(0, 7) : rawPeriod.slice(0, 4),
        revenue: parseNaverNumber(item.totRevnu ?? item.saleAmt ?? item.revenue),
        operatingIncome: parseNaverNumber(item.bsopPrfi ?? item.bsopProfi ?? item.operatingIncome),
        netIncome: parseNaverNumber(item.thtrNtis ?? item.netProfi ?? item.netIncome),
        eps: parseNaverNumber(item.eps),
      };
    }).filter((r) => r.period);
  }

  return {
    annualFinancials: parseRows(annualData, false),
    quarterlyFinancials: parseRows(quarterData, true),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.trim();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const supabase = getServerSupabaseClient();
  const { data: company } = supabase
    ? await supabase.from("companies_krx").select("name_kr,market").eq("ticker", ticker).maybeSingle()
    : { data: null };

  const suffix = company?.market === "KOSDAQ" ? ".KQ" : ".KS";
  const yahooTicker = `${ticker}${suffix}`;

  const now = Math.floor(Date.now() / 1000);
  const oneYearAgo = now - 365 * 24 * 3600;

  const [chartData, naverFinancials] = await Promise.all([
    safeFetch(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&period1=${oneYearAgo}&period2=${now}`),
    fetchNaverFinancials(ticker),
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

  return NextResponse.json({
    companyName: company?.name_kr ?? ticker,
    ticker,
    market: company?.market ?? "KRX",
    currentPrice,
    changePct,
    priceHistory,
    annualFinancials: naverFinancials.annualFinancials,
    quarterlyFinancials: naverFinancials.quarterlyFinancials,
  });
}
