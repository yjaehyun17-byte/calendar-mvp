import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/serverSupabase";

// GET /api/universe/checks — 체크된 event_id 목록
export async function GET() {
  const supabase = getServerSupabaseClient();
  if (!supabase) return NextResponse.json([], { status: 200 });

  const { data, error } = await supabase
    .from("universe_event_checks")
    .select("event_id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map((r: { event_id: string }) => r.event_id));
}

// POST /api/universe/checks — 체크 (토글)
export async function POST(request: Request) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "No DB" }, { status: 500 });

  const { event_id, ticker } = (await request.json()) as { event_id: string; ticker: string };
  if (!event_id || !ticker) {
    return NextResponse.json({ error: "event_id and ticker required" }, { status: 400 });
  }

  // 이미 체크된 경우 삭제(토글), 아니면 삽입
  const { data: existing } = await supabase
    .from("universe_event_checks")
    .select("event_id")
    .eq("event_id", event_id)
    .maybeSingle();

  if (existing) {
    await supabase.from("universe_event_checks").delete().eq("event_id", event_id);
    return NextResponse.json({ checked: false });
  } else {
    await supabase.from("universe_event_checks").insert({ event_id, ticker });
    return NextResponse.json({ checked: true });
  }
}
