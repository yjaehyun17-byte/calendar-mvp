import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/serverSupabase";

type YahooChartResult = {
  timestamp: number[];
  indicators: { quote: Array<{ close: (number | null)[] }> };
};

type IncomeStatement = {
  endDate: { fmt: string };
  totalRevenue?: { raw: number };
  operatingIncome?: { raw: number };
  netIncome?: { raw: number };
  basicEPS?: { raw: number };
};

type EarningsTrend = {
  period: string;
  endDate?: { fmt: string };
  earningsEstimate?: { avg?: { raw: number }; low?: { raw: number }; high?: { raw: number }; numberOfAnalysts?: { raw: number } };
  revenueEstimate?: { avg?: { raw: number }; low?: { raw: number }; high?: { raw: number } };
};

async function safeFetch(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  return res.json();
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

  const [chartData, summaryData] = await Promise.all([
    safeFetch(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&period1=${oneYearAgo}&period2=${now}`),
    safeFetch(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${yahooTicker}?modules=incomeStatementHistory,incomeStatementHistoryQuarterly,earningsTrends`),
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

  // Annual financials
  const annualRaw: IncomeStatement[] =
    summaryData?.quoteSummary?.result?.[0]?.incomeStatementHistory?.incomeStatementHistory ?? [];
  const annualFinancials = annualRaw.map((s) => ({
    period: s.endDate.fmt.slice(0, 4),
    revenue: s.totalRevenue?.raw ?? null,
    operatingIncome: s.operatingIncome?.raw ?? null,
    netIncome: s.netIncome?.raw ?? null,
    eps: s.basicEPS?.raw ?? null,
  })).reverse();

  // Quarterly financials
  const quarterlyRaw: IncomeStatement[] =
    summaryData?.quoteSummary?.result?.[0]?.incomeStatementHistoryQuarterly?.incomeStatementHistory ?? [];
  const quarterlyFinancials = quarterlyRaw.map((s) => ({
    period: s.endDate.fmt.slice(0, 7),
    revenue: s.totalRevenue?.raw ?? null,
    operatingIncome: s.operatingIncome?.raw ?? null,
    netIncome: s.netIncome?.raw ?? null,
    eps: s.basicEPS?.raw ?? null,
  })).reverse();

  // Estimates
  const trendsRaw: EarningsTrend[] =
    summaryData?.quoteSummary?.result?.[0]?.earningsTrends?.trend ?? [];
  const estimates = trendsRaw
    .filter((t) => ["0q", "+1q", "0y", "+1y"].includes(t.period))
    .map((t) => ({
      period: t.period,
      label: { "0q": "당분기", "+1q": "다음분기", "0y": "당해연도", "+1y": "내년도" }[t.period] ?? t.period,
      endDate: t.endDate?.fmt ?? null,
      epsAvg: t.earningsEstimate?.avg?.raw ?? null,
      epsLow: t.earningsEstimate?.low?.raw ?? null,
      epsHigh: t.earningsEstimate?.high?.raw ?? null,
      analysts: t.earningsEstimate?.numberOfAnalysts?.raw ?? null,
      revenueAvg: t.revenueEstimate?.avg?.raw ?? null,
    }));

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
    annualFinancials,
    quarterlyFinancials,
    estimates,
  });
}
