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
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return null;
  return digits.padStart(6, "0").slice(-6);
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

function parseTotalCount(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const asRecord = payload as Record<string, unknown>;
  const response = asRecord.response as Record<string, unknown> | undefined;
  const body = response?.body as Record<string, unknown> | undefined;
  const totalCount = body?.totalCount;
  if (typeof totalCount === "number") return totalCount;
  if (typeof totalCount === "string") {
    const parsed = Number(totalCount);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
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

  const numOfRows = 500;
  const fetchedRows: ListedCompany[] = [];
  let totalCount: number | null = null;

  for (let pageNo = 1; pageNo <= 100; pageNo += 1) {
    const url = new URL(endpoint);
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("numOfRows", String(numOfRows));
    url.searchParams.set("pageNo", String(pageNo));
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
    fetchedRows.push(...rows);

    if (totalCount === null) {
      totalCount = parseTotalCount(json);
    }

    if (rows.length === 0) break;
    if (totalCount !== null && fetchedRows.length >= totalCount) break;
    if (rows.length < numOfRows) break;
  }

  const deduped = Array.from(
    new Map(fetchedRows.map((row) => [row.ticker, row])).values(),
  );

  let upserted = 0;
  for (const batch of chunk(deduped, 1000)) {
    const { error } = await supabase
      .from("companies_krx")
      .upsert(batch, { onConflict: "ticker" });

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Failed to upsert companies", detail: error.message },
        { status: 500 },
      );
    }

    upserted += batch.length;
  }

  return NextResponse.json({ ok: true, fetched: deduped.length, upserted });
}
