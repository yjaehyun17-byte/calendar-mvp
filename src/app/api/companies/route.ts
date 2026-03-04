import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/serverSupabase";

type CompanyRow = {
  ticker: string;
  name_kr: string;
  market: string | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query =
    searchParams.get("query")?.trim() || searchParams.get("q")?.trim() || "";

  if (query.length < 2) {
    return NextResponse.json({ companies: [] });
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Supabase server env is missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from("companies_krx")
    .select("ticker,name_kr,market")
    .ilike("name_kr", `%${query}%`)
    .order("name_kr", { ascending: true })
    .limit(20);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Failed to search companies", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ companies: (data ?? []) as CompanyRow[] });
}
