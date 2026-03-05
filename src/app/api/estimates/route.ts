import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/serverSupabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.trim();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const supabase = getServerSupabaseClient();
  if (!supabase) return NextResponse.json([], { status: 200 });

  const { data, error } = await supabase
    .from("stock_estimates")
    .select("*")
    .eq("ticker", ticker)
    .order("period", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "No DB" }, { status: 500 });

  const body = (await request.json()) as {
    ticker: string;
    period: string;
    revenue?: number | null;
    operating_income?: number | null;
    net_income?: number | null;
    eps?: number | null;
  };

  const { data, error } = await supabase
    .from("stock_estimates")
    .upsert(
      {
        ticker: body.ticker,
        period: body.period,
        revenue: body.revenue ?? null,
        operating_income: body.operating_income ?? null,
        net_income: body.net_income ?? null,
        eps: body.eps ?? null,
      },
      { onConflict: "ticker,period" }
    )
    .select()
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

  const { error } = await supabase.from("stock_estimates").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
