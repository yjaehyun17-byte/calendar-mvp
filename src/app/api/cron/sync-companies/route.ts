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
  if (/^[0-9]+$/.test(cleaned)) return cleaned.padStart(6, "0").slice(-6);
  return cleaned;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function parseItems(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") return [];
  const asRecord = payload as Record<string, unknown>;
  const body = (asRecord.response as Record<string, unknown> | undefined)?.body as Record<string, unknown> | undefined;
  const item = (body?.items as Record<string, unknown> | undefined)?.item;
  if (Array.isArray(item)) return item.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  if (item && typeof item === "object") return [item as Record<string, unknown>];
  return [];
}

function normalizeRow(row: Record<string, unknown>): ListedCompany | null {
  const ticker = normalizeTicker(row.srtnCd ?? row.srtncd ?? row.stck_shrn_iscd ?? row.ticker ?? row.code);
  const name = pickString(row, ["itmsNm", "itmsnm", "name", "name_kr", "종목명"]);
  if (!ticker || !name) return null;
  return {
    ticker,
    name_kr: name,
    market: pickString(row, ["mrktCtg", "mrktctg", "market", "시장구분"]),
    isin: pickString(row, ["isinCd", "isincd", "isin"]),
    corp_name: pickString(row, ["corp_name", "corpNm", "corpnm", "법인명"]),
    base_date: normalizeDate(row.basDt ?? row.basdt ?? row.base_date ?? row.기준일자),
  };
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("token") === secret;
}

const PAGE_SIZE = 200;
const MAX_PAGES = 30; // 전종목 약 2,500개 기준 여유 있게 설정

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const endpoint = process.env.DATA_GO_KR_KRX_LISTED_ENDPOINT;
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  const supabase = getServerSupabaseClient();

  if (!endpoint || !serviceKey || !supabase) {
    return NextResponse.json({ ok: false, error: "Missing required environment variables" }, { status: 500 });
  }

  const allRows: ListedCompany[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL(endpoint);
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("numOfRows", String(PAGE_SIZE));
    url.searchParams.set("pageNo", String(page));
    url.searchParams.set("resultType", "json");

    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json({ ok: false, error: `data.go.kr fetch failed at page ${page}`, detail: `status=${response.status}` }, { status: 500 });
    }

    const json = (await response.json()) as unknown;
    const rows = parseItems(json).map(normalizeRow).filter((r): r is ListedCompany => r !== null);

    allRows.push(...rows);
    if (rows.length < PAGE_SIZE) break; // 마지막 페이지
  }

  if (allRows.length > 0) {
    const { error } = await supabase
      .from("companies_krx")
      .upsert(allRows, { onConflict: "ticker" });

    if (error) {
      return NextResponse.json({ ok: false, error: "Upsert failed", detail: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, total: allRows.length, synced_at: new Date().toISOString() });
}
