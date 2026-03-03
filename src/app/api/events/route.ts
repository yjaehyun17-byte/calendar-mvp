import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

type EventRow = {
  id: string;
  title: string;
  start_at: string;
  end_at: string | null;
  notes: string | null;
  color: string | null;
};

type EventPayload = {
  title?: string;
  start?: string;
  end?: string | null;
  notes?: string;
  color?: string;
};

function normalizeIso(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toApiEvent(row: EventRow) {
  return {
    id: row.id,
    title: row.title,
    start: row.start_at,
    end: row.end_at,
    notes: row.notes ?? "",
    color: row.color ?? "#2563eb",
  };
}

export async function GET() {
  const { data, error } = await supabase
    .from("events")
    .select("id,title,start_at,end_at,notes,color")
    .order("start_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data as EventRow[]).map(toApiEvent));
}

export async function POST(request: Request) {
  const body = (await request.json()) as EventPayload;

  const title = body.title?.trim();
  const startAt = normalizeIso(body.start);
  const endAt = normalizeIso(body.end ?? null);

  if (!title || !startAt) {
    return NextResponse.json(
      { error: "title and start are required." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("events")
    .insert({
      title,
      start_at: startAt,
      end_at: endAt,
      notes: body.notes?.trim() ?? "",
      color: body.color ?? "#2563eb",
    })
    .select("id,title,start_at,end_at,notes,color")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(toApiEvent(data as EventRow), { status: 201 });
}
