import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/serverSupabase";

export type Disclosure = {
  id: string;
  date: string;
  label: string;
  url: string;
  created_at: string;
};

export async function GET() {
  const supabase = getServerSupabaseClient();
  if (!supabase) return NextResponse.json([], { status: 200 });

  const { data, error } = await supabase
    .from("disclosures")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "No DB" }, { status: 500 });

  const body = (await req.json()) as { date: string; label: string; url: string };

  if (!body.date || !body.url) {
    return NextResponse.json({ error: "date and url are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("disclosures")
    .insert({ date: body.date, label: body.label ?? "", url: body.url })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "No DB" }, { status: 500 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase.from("disclosures").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
