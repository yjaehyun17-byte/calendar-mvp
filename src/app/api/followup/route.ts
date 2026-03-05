import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/serverSupabase";

type EventRow = {
  id: string;
  title: string;
  start_at: string;
  notes: string | null;
  ir_name: string | null;
  ir_contact: string | null;
  ir_address: string | null;
};

type StockResult = {
  priceAtEvent: number | null;
  currentPrice: number | null;
  returnPct: number | null;
};

async function fetchStockReturn(
  ticker: string,
  market: string | null,
  eventDate: Date
): Promise<StockResult> {
  const suffix = market === "KOSDAQ" ? ".KQ" : ".KS";
  const yahooTicker = `${ticker}${suffix}`;

  // Start from one day before event to ensure we get a price even if event is on weekend
  const period1 = Math.floor(eventDate.getTime() / 1000) - 86400;
  const period2 = Math.floor(Date.now() / 1000);

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&period1=${period1}&period2=${period2}`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) return { priceAtEvent: null, currentPrice: null, returnPct: null };

    const data = (await res.json()) as {
      chart: {
        result: Array<{
          indicators: { quote: Array<{ close: (number | null)[] }> };
        }> | null;
      };
    };

    const result = data?.chart?.result?.[0];
    if (!result) return { priceAtEvent: null, currentPrice: null, returnPct: null };

    const closes = result.indicators.quote[0].close;
    const valid = closes.filter((c): c is number => c !== null && c > 0);
    if (valid.length < 2) return { priceAtEvent: null, currentPrice: null, returnPct: null };

    const priceAtEvent = valid[0];
    const currentPrice = valid[valid.length - 1];
    const returnPct = ((currentPrice - priceAtEvent) / priceAtEvent) * 100;

    return { priceAtEvent, currentPrice, returnPct };
  } catch {
    return { priceAtEvent: null, currentPrice: null, returnPct: null };
  }
}

export async function GET() {
  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase server environment variables are missing." },
      { status: 500 }
    );
  }

  const { data: events, error } = await supabase
    .from("events")
    .select("id,title,start_at,notes,ir_name,ir_contact,ir_address")
    .order("start_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();

  const parsed = ((events ?? []) as EventRow[])
    .map((event) => {
      const typeMatch = event.title.match(/^\[(탐방|컨콜)\]/);
      if (!typeMatch) return null;

      const eventType = typeMatch[1];
      const titleWithoutType = event.title.replace(/^\[(탐방|컨콜)\]\s*/, "");
      const companyMatch = titleWithoutType.match(/^(.+?)\s*\((\d+)\.KRX\)$/);
      if (!companyMatch) return null;

      return {
        id: event.id,
        companyName: companyMatch[1].trim(),
        ticker: companyMatch[2],
        eventType,
        eventDate: event.start_at,
        daysAgo: Math.floor(
          (now.getTime() - new Date(event.start_at).getTime()) / (1000 * 60 * 60 * 24)
        ),
        notes: event.notes ?? "",
        irName: event.ir_name ?? "",
        irContact: event.ir_contact ?? "",
        irAddress: event.ir_address ?? "",
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Fetch market info and stock prices in parallel
  const items = await Promise.all(
    parsed.map(async (item) => {
      const { data: company } = await supabase
        .from("companies_krx")
        .select("market")
        .eq("ticker", item.ticker)
        .maybeSingle();

      const stockData = await fetchStockReturn(
        item.ticker,
        company?.market ?? null,
        new Date(item.eventDate)
      );

      return { ...item, ...stockData };
    })
  );

  return NextResponse.json(items);
}
