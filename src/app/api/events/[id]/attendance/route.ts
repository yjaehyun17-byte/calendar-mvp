import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

type AttendanceStatus = "attending" | "maybe" | "not_attending";

type AttendanceRow = {
  event_id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  status: AttendanceStatus;
};

type AttendancePayload = {
  userId?: string;
  userName?: string | null;
  userEmail?: string | null;
  status?: AttendanceStatus;
};

async function getAttendanceRows(eventId: string) {
  const { data, error } = await supabase
    .from("event_attendance")
    .select("event_id,user_id,user_name,user_email,status")
    .eq("event_id", eventId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AttendanceRow[];
}

function toSummary(rows: AttendanceRow[]) {
  return {
    attending: rows.filter((row) => row.status === "attending").length,
    maybe: rows.filter((row) => row.status === "maybe").length,
    not_attending: rows.filter((row) => row.status === "not_attending").length,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim();

  try {
    const rows = await getAttendanceRows(id);
    const myStatus = userId
      ? rows.find((row) => row.user_id === userId)?.status ?? null
      : null;

    return NextResponse.json({
      myStatus,
      summary: toSummary(rows),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as AttendancePayload;

  const userId = body.userId?.trim();
  const status = body.status;

  if (!userId || !status) {
    return NextResponse.json(
      { error: "userId and status are required." },
      { status: 400 },
    );
  }

  if (!["attending", "maybe", "not_attending"].includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const { error } = await supabase.from("event_attendance").upsert(
    {
      event_id: id,
      user_id: userId,
      user_name: body.userName?.trim() || null,
      user_email: body.userEmail?.trim() || null,
      status,
    },
    {
      onConflict: "event_id,user_id",
    },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    const rows = await getAttendanceRows(id);

    return NextResponse.json({
      myStatus: rows.find((row) => row.user_id === userId)?.status ?? null,
      summary: toSummary(rows),
    });
  } catch (summaryError) {
    const message =
      summaryError instanceof Error ? summaryError.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
