import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/serverSupabase";

export async function GET() {
  const supabase = getServerSupabaseClient();
  if (!supabase) return NextResponse.json([], { status: 200 });

  // 유니버스 ticker 목록
  const { data: universe } = await supabase.from("universe").select("ticker");
  if (!universe || universe.length === 0) return NextResponse.json([]);
  const tickers = (universe as { ticker: string }[]).map((u) => u.ticker);

  // 이번달 범위
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  // 이번달 전체 이벤트 조회
  const { data: events, error } = await supabase
    .from("events")
    .select("id,title,start_at")
    .gte("start_at", monthStart)
    .lte("start_at", monthEnd)
    .order("start_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 유니버스 기업만 필터
  const items = ((events ?? []) as { id: string; title: string; start_at: string }[])
    .map((ev) => {
      const typeMatch = ev.title.match(/^\[(탐방|컨콜)\]/);
      if (!typeMatch) return null;
      const titleWithoutType = ev.title.replace(/^\[(탐방|컨콜)\]\s*/, "");
      const companyMatch = titleWithoutType.match(/^(.+?)\s*\(([A-Z0-9]+)\.KRX\)$/);
      if (!companyMatch) return null;
      const ticker = companyMatch[2];
      if (!tickers.includes(ticker)) return null;
      return {
        id: ev.id,
        companyName: companyMatch[1].trim(),
        ticker,
        eventType: typeMatch[1],
        date: ev.start_at.slice(0, 10),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return NextResponse.json(items);
}
