import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/serverSupabase";

type AttendanceStatus = "attending" | "maybe" | "not_attending";

type AttendanceRow = {
  event_id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  status: AttendanceStatus;
  gcal_event_id: string | null;
};

type AttendancePayload = {
  userId?: string;
  userName?: string | null;
  userEmail?: string | null;
  action?: "attend" | "cancel";
  providerToken?: string | null;
};

type GCalEventBody = {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
};

type GCalEventResponse = { id?: string; error?: { message: string } };

function getApiClient() {
  const client = getServerSupabaseClient();
  if (!client) throw new Error("Supabase server environment variables are missing.");
  return client;
}

async function getAttendanceRows(eventId: string) {
  const supabase = getApiClient();
  const { data, error } = await supabase
    .from("event_attendance")
    .select("event_id,user_id,user_name,user_email,status,gcal_event_id")
    .eq("event_id", eventId)
    .eq("status", "attending")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as AttendanceRow[];
}

function toApiPayload(rows: AttendanceRow[], userId: string | null) {
  return {
    myStatus: userId && rows.some((r) => r.user_id === userId) ? "attending" : null,
    summary: { attending: rows.length, maybe: 0, not_attending: 0 },
    attendees: rows.map((r) => ({
      userId: r.user_id,
      userName: r.user_name || r.user_email || r.user_id,
      userEmail: r.user_email,
    })),
  };
}

async function createGCalEvent(
  providerToken: string,
  title: string,
  startAt: string,
  endAt: string | null,
  notes: string | null,
  location: string | null,
): Promise<string | null> {
  const body: GCalEventBody = {
    summary: title,
    ...(notes ? { description: notes } : {}),
    ...(location ? { location } : {}),
    start: { dateTime: startAt, timeZone: "Asia/Seoul" },
    end: { dateTime: endAt ?? startAt, timeZone: "Asia/Seoul" },
  };

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${providerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    },
  );

  const json = (await res.json()) as GCalEventResponse;
  if (!res.ok || !json.id) {
    console.error("GCal create failed:", json.error?.message ?? res.status);
    return null;
  }
  return json.id;
}

async function deleteGCalEvent(providerToken: string, gcalEventId: string): Promise<boolean> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${gcalEventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${providerToken}` },
      signal: AbortSignal.timeout(8000),
    },
  );
  // 204 = success, 404 = already deleted (also OK)
  return res.status === 204 || res.status === 404;
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
    return NextResponse.json({ error: "userId and action are required." }, { status: 400 });
  }
  if (!["attend", "cancel"].includes(action)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  try {
    const supabase = getApiClient();

    if (action === "attend") {
      let gcalEventId: string | null = null;

      if (body.providerToken) {
        // 이벤트 상세 정보 조회
        const { data: event } = await supabase
          .from("events")
          .select("title,start_at,end_at,notes,ir_address")
          .eq("id", id)
          .single();

        if (event) {
          gcalEventId = await createGCalEvent(
            body.providerToken,
            event.title as string,
            event.start_at as string,
            event.end_at as string | null,
            event.notes as string | null,
            event.ir_address as string | null,
          );
        }
      }

      const { error } = await supabase.from("event_attendance").upsert(
        {
          event_id: id,
          user_id: userId,
          user_name: body.userName?.trim() || null,
          user_email: body.userEmail?.trim() || null,
          status: "attending",
          ...(gcalEventId ? { gcal_event_id: gcalEventId } : {}),
        },
        { onConflict: "event_id,user_id" },
      );

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (action === "cancel") {
      if (body.providerToken) {
        // 기존 gcal_event_id 조회
        const { data: row } = await supabase
          .from("event_attendance")
          .select("gcal_event_id")
          .eq("event_id", id)
          .eq("user_id", userId)
          .maybeSingle();

        const gcalEventId = (row as { gcal_event_id: string | null } | null)?.gcal_event_id;
        if (gcalEventId) {
          await deleteGCalEvent(body.providerToken, gcalEventId);
        }
      }

      const { error } = await supabase
        .from("event_attendance")
        .delete()
        .eq("event_id", id)
        .eq("user_id", userId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = await getAttendanceRows(id);
    return NextResponse.json(toApiPayload(rows, userId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
