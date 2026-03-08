import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/serverSupabase";

// GET /api/checklists?ticker=xxx
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.trim();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const supabase = getServerSupabaseClient();
  if (!supabase) return NextResponse.json([], { status: 200 });

  const { data, error } = await supabase
    .from("company_checklists")
    .select("id,ticker,content,checked")
    .eq("ticker", ticker)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/checklists — 항목 추가
export async function POST(request: Request) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "No DB" }, { status: 500 });

  const { ticker, content } = (await request.json()) as { ticker: string; content: string };
  if (!ticker || !content?.trim()) {
    return NextResponse.json({ error: "ticker and content required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("company_checklists")
    .insert({ ticker, content: content.trim() })
    .select("id,ticker,content,checked")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH /api/checklists — 체크 토글
export async function PATCH(request: Request) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "No DB" }, { status: 500 });

  const { id, checked } = (await request.json()) as { id: string; checked: boolean };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("company_checklists")
    .update({ checked })
    .eq("id", id)
    .select("id,ticker,content,checked")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/checklists?id=xxx
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = getServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "No DB" }, { status: 500 });

  const { error } = await supabase.from("company_checklists").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
