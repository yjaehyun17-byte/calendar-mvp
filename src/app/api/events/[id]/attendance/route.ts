import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/serverSupabase";

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
  action?: "attend" | "cancel";
};

function getApiClient() {
  const client = getServerSupabaseClient();

  if (!client) {
    throw new Error("Supabase server environment variables are missing.");
  }

  return client;
}

async function getAttendanceRows(eventId: string) {
  const supabase = getApiClient();

  const { data, error } = await supabase
    .from("event_attendance")
    .select("event_id,user_id,user_name,user_email,status")
    .eq("event_id", eventId)
    .eq("status", "attending")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AttendanceRow[];
}

function toApiPayload(rows: AttendanceRow[], userId: string | null) {
  const attendees = rows.map((row) => ({
    userId: row.user_id,
    userName: row.user_name || row.user_email || row.user_id,
    userEmail: row.user_email,
  }));

  return {
    myStatus: userId && rows.some((row) => row.user_id === userId) ? "attending" : null,
    summary: {
      attending: rows.length,
      maybe: 0,
      not_attending: 0,
    },
    attendees,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim() || null;

  try {
    const rows = await getAttendanceRows(id);
    return NextResponse.json(toApiPayload(rows, userId));
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
  const action = body.action;

  if (!userId || !action) {
    return NextResponse.json(
      { error: "userId and action are required." },
      { status: 400 },
    );
  }

  if (!["attend", "cancel"].includes(action)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  try {
    const supabase = getApiClient();

    if (action === "attend") {
      const { error } = await supabase.from("event_attendance").upsert(
        {
          event_id: id,
          user_id: userId,
          user_name: body.userName?.trim() || null,
          user_email: body.userEmail?.trim() || null,
          status: "attending",
        },
        {
          onConflict: "event_id,user_id",
        },
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    if (action === "cancel") {
      const { error } = await supabase
        .from("event_attendance")
        .delete()
        .eq("event_id", id)
        .eq("user_id", userId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    const rows = await getAttendanceRows(id);
    return NextResponse.json(toApiPayload(rows, userId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
