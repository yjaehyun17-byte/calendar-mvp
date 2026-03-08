import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/serverSupabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.trim();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const supabase = getServerSupabaseClient();
  if (!supabase) return NextResponse.json([], { status: 200 });

  const { data, error } = await supabase
    .from("company_memos")
    .select("id,ticker,visit_date,summary,details")
    .eq("ticker", ticker)
    .order("visit_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "No DB" }, { status: 500 });

  const body = (await request.json()) as {
    ticker: string;
    visit_date: string;
    summary: string;
    details: string;
  };

  if (!body.ticker || !body.visit_date) {
    return NextResponse.json({ error: "ticker and visit_date required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("company_memos")
    .insert({
      ticker: body.ticker,
      visit_date: body.visit_date,
      summary: body.summary?.trim() ?? "",
      details: body.details?.trim() ?? "",
    })
    .select("id,ticker,visit_date,summary,details")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = getServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "No DB" }, { status: 500 });

  const { error } = await supabase.from("company_memos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
