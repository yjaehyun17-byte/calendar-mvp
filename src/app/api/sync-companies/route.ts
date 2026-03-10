import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/serverSupabase";

type ListedCompany = {
  ticker: string;
  name_kr: string;
  market: string | null;
  isin: string | null;
  corp_name: string | null;
  base_date: string | null;
};

function normalizeTicker(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const cleaned = String(value).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleaned || cleaned.length > 20) return null;
  // 숫자만 있는 경우 6자리 zero-pad (기존 한국 종목코드)
  if (/^[0-9]+$/.test(cleaned)) return cleaned.padStart(6, "0").slice(-6);
  // 영문 포함(영문 티커, 혼합 코드)은 그대로
  return cleaned;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  return `${year}-${month}-${day}`;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function parseItems(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") return [];

  const asRecord = payload as Record<string, unknown>;
  const response = asRecord.response as Record<string, unknown> | undefined;
  const body = response?.body as Record<string, unknown> | undefined;
  const items = body?.items as Record<string, unknown> | undefined;
  const item = items?.item;

  if (Array.isArray(item)) {
    return item.filter(
      (row): row is Record<string, unknown> => Boolean(row) && typeof row === "object",
    );
  }

  if (item && typeof item === "object") {
    return [item as Record<string, unknown>];
  }

  return [];
}

function normalizeRow(row: Record<string, unknown>): ListedCompany | null {
  const ticker = normalizeTicker(
    row.srtnCd ?? row.srtncd ?? row.stck_shrn_iscd ?? row.ticker ?? row.code,
  );
  const name = pickString(row, ["itmsNm", "itmsnm", "name", "name_kr", "종목명"]);

  if (!ticker || !name) return null;

  const market = pickString(row, ["mrktCtg", "mrktctg", "market", "시장구분"]);
  const isin = pickString(row, ["isinCd", "isincd", "isin"]);
  const corpName = pickString(row, ["corp_name", "corpNm", "corpnm", "법인명"]);
  const baseDate = normalizeDate(row.basDt ?? row.basdt ?? row.base_date ?? row.기준일자);

  return {
    ticker,
    name_kr: name,
    market,
    isin,
    corp_name: corpName,
    base_date: baseDate,
  };
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) {
    return true;
  }

  const { searchParams } = new URL(request.url);
  return searchParams.get("token") === secret;
}

function parsePage(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }

  return 0;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const endpoint = process.env.DATA_GO_KR_KRX_LISTED_ENDPOINT;
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  const supabase = getServerSupabaseClient();

  if (!endpoint || !serviceKey || !supabase) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing required environment variables",
        detail:
          "DATA_GO_KR_KRX_LISTED_ENDPOINT, DATA_GO_KR_SERVICE_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY are required.",
      },
      { status: 500 },
    );
  }

  const { data: syncState, error: syncStateError } = await supabase
    .from("sync_state")
    .select("value")
    .eq("key", "krx_page")
    .maybeSingle();

  if (syncStateError) {
    return NextResponse.json(
      { ok: false, error: "Failed to read sync state", detail: syncStateError.message },
      { status: 500 },
    );
  }

  const currentPage = parsePage(syncState?.value);
  const nextPage = currentPage + 1;

  const url = new URL(endpoint);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("numOfRows", "200");
  url.searchParams.set("pageNo", String(nextPage));
  url.searchParams.set("resultType", "json");

  const response = await fetch(url.toString(), { cache: "no-store" });

  if (!response.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to fetch data.go.kr",
        detail: `status=${response.status}`,
      },
      { status: 500 },
    );
  }

  const json = (await response.json()) as unknown;
  const rows = parseItems(json).map((row) => normalizeRow(row)).filter(Boolean) as ListedCompany[];

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from("companies_krx")
      .upsert(rows, { onConflict: "ticker" });

    if (upsertError) {
      return NextResponse.json(
        { ok: false, error: "Failed to upsert companies", detail: upsertError.message },
        { status: 500 },
      );
    }
  }

  const { error: syncStateUpdateError } = await supabase
    .from("sync_state")
    .update({ value: nextPage })
    .eq("key", "krx_page");

  if (syncStateUpdateError) {
    return NextResponse.json(
      { ok: false, error: "Failed to update sync state", detail: syncStateUpdateError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, page: nextPage, inserted: rows.length });
}
