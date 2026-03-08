import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/serverSupabase";

type TimelineEntry = { date: string; content: string };

type MemoRow = {
  ticker: string;
  visit_date: string;
  timeline: TimelineEntry[];
};

type CompanyRow = { ticker: string; name_kr: string };

export async function GET() {
  const supabase = getServerSupabaseClient();
  if (!supabase) return NextResponse.json([], { status: 200 });

  // 유니버스 ticker 목록 조회
  const { data: universe, error: uErr } = await supabase
    .from("universe")
    .select("ticker");

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
  if (!universe || universe.length === 0) return NextResponse.json([]);

  const tickers = (universe as { ticker: string }[]).map((u) => u.ticker);

  // 해당 ticker들의 메모(타임라인 포함) 조회
  const { data: memos, error: mErr } = await supabase
    .from("company_memos")
    .select("ticker,visit_date,timeline")
    .in("ticker", tickers);

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  // 기업명 조회
  const { data: companies } = await supabase
    .from("companies_krx")
    .select("ticker,name_kr")
    .in("ticker", tickers);

  const nameMap = new Map<string, string>(
    ((companies ?? []) as CompanyRow[]).map((c) => [c.ticker, c.name_kr])
  );

  // 타임라인 항목을 캘린더 이벤트로 변환
  const events: { id: string; title: string; date: string; ticker: string; companyName: string; visitDate: string }[] = [];

  ((memos ?? []) as MemoRow[]).forEach((memo) => {
    const companyName = nameMap.get(memo.ticker) ?? memo.ticker;
    if (!Array.isArray(memo.timeline)) return;
    memo.timeline.forEach((entry, idx) => {
      if (!entry.date) return;
      events.push({
        id: `${memo.ticker}-${memo.visit_date}-${idx}`,
        title: `[${companyName}] ${entry.content}`,
        date: entry.date,
        ticker: memo.ticker,
        companyName,
        visitDate: memo.visit_date,
      });
    });
  });

  // 날짜순 정렬
  events.sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json(events);
}
