import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/serverSupabase";

// GET /api/universe — 유니버스 ticker 목록
export async function GET() {
  const supabase = getServerSupabaseClient();
  if (!supabase) return NextResponse.json([], { status: 200 });

  const { data, error } = await supabase
    .from("universe")
    .select("ticker,added_at")
    .order("added_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/universe — 유니버스 등록
export async function POST(request: Request) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "No DB" }, { status: 500 });

  const { ticker } = (await request.json()) as { ticker: string };
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const { error } = await supabase
    .from("universe")
    .upsert({ ticker }, { onConflict: "ticker" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/universe?ticker=xxx — 유니버스 해제
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const supabase = getServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "No DB" }, { status: 500 });

  const { error } = await supabase.from("universe").delete().eq("ticker", ticker);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
