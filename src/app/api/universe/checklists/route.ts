import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/serverSupabase";

type ChecklistRow = { id: string; ticker: string; content: string; checked: boolean };
type CompanyRow = { ticker: string; name_kr: string };

export async function GET() {
  const supabase = getServerSupabaseClient();
  if (!supabase) return NextResponse.json([], { status: 200 });

  const { data: universe } = await supabase.from("universe").select("ticker");
  if (!universe || universe.length === 0) return NextResponse.json([]);

  const tickers = (universe as { ticker: string }[]).map((u) => u.ticker);

  const [{ data: checklists }, { data: companies }] = await Promise.all([
    supabase
      .from("company_checklists")
      .select("id,ticker,content,checked")
      .in("ticker", tickers)
      .order("created_at", { ascending: true }),
    supabase
      .from("companies_krx")
      .select("ticker,name_kr")
      .in("ticker", tickers),
  ]);

  const nameMap = new Map<string, string>(
    ((companies ?? []) as CompanyRow[]).map((c) => [c.ticker, c.name_kr])
  );

  const result = ((checklists ?? []) as ChecklistRow[]).map((item) => ({
    ...item,
    companyName: nameMap.get(item.ticker) ?? item.ticker,
  }));

  return NextResponse.json(result);
}
