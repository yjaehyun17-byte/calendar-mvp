import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/serverSupabase";

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

function getApiClient() {
  const supabase = getServerSupabaseClient();

  if (!supabase) {
    return null;
  }

  return supabase;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = getApiClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase server environment variables are missing." },
      { status: 500 },
    );
  }

  const { id } = await params;
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
    .update({
      title,
      start_at: startAt,
      end_at: endAt,
      notes: body.notes?.trim() ?? "",
      color: body.color ?? "#2563eb",
    })
    .eq("id", id)
    .select("id,title,start_at,end_at,notes,color")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(toApiEvent(data as EventRow));
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = getApiClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase server environment variables are missing." },
      { status: 500 },
    );
  }

  const { id } = await params;

  const { error } = await supabase.from("events").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
