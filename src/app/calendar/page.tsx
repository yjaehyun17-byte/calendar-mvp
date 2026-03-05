"use client";

import { useEffect, useMemo, useState } from "react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import type {
  DateSelectArg,
  EventApi,
  EventClickArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import FullCalendar from "@fullcalendar/react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string | null;
  notes: string;
  color: string;
};

type AttendanceSummary = {
  attending: number;
  maybe: number;
  not_attending: number;
};

type AttendanceMember = {
  userId: string;
  userName: string;
  userEmail: string | null;
};

type AttendanceApiResponse = {
  myStatus: AttendanceStatus | null;
  summary: AttendanceSummary;
  attendees: AttendanceMember[];
};

type EventFormState = {
  companyName: string;
  companyTicker: string;
  companyMarket: string;
  start: string;
  end: string;
  notes: string;
  color: string;
};

type CompanySearchResult = {
  ticker: string;
  name_kr: string;
  market: string | null;
};

type CompaniesApiResponse = {
  companies: CompanySearchResult[];
};

const DEFAULT_COLOR = "#2563eb";

type EventTimeChangeArg = {
  event: EventApi;
  revert: () => void;
};

function toDateTimeLocal(value?: string | Date | null): string {
  if (!value) return "";

  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}
function isSameLocalDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}
function getReadableTextColor(bgColor: string): string {
  const normalized = bgColor.trim();
  const color = normalized.startsWith("#") ? normalized.slice(1) : normalized;
  const expanded =
    color.length === 3
      ? color
          .split("")
          .map((value) => value + value)
          .join("")
      : color;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return "#ffffff";
  }

  const r = Number.parseInt(expanded.substring(0, 2), 16);
  const g = Number.parseInt(expanded.substring(2, 4), 16);
  const b = Number.parseInt(expanded.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  return brightness > 128 ? "#000000" : "#ffffff";
}

function getGoogleAuthHint(errorMessage: string): string {
  if (errorMessage.includes("Unsupported provider")) {
    return "현재 Supabase 프로젝트에서 Google Provider가 꺼져 있어 로그인할 수 없습니다. Supabase Dashboard > Authentication > Providers > Google에서 Enabled를 켜고 Client ID/Secret 저장 후 다시 시도해 주세요.";
  }

  if (errorMessage.includes("redirect_to") || errorMessage.includes("redirect")) {
    return "Redirect URL 설정을 확인해 주세요. Supabase Authentication > URL Configuration의 Site URL/Redirect URLs에 현재 배포 URL을 추가해야 합니다.";
  }

  return "Supabase 인증 설정(Provider 활성화, Client ID/Secret, Redirect URL)을 확인해 주세요.";
}

function pickFirstText(values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function stripGoogleFinanceLines(notes: string): string {
  return notes
    .split("\n")
    .filter((line) => !line.trim().startsWith("Google Finance:"))
    .join("\n")
    .trim();
}

function getDisplayName(user: User | null): string {
  if (!user) return "";

  const metadata = user.user_metadata as {
    name?: string;
    full_name?: string;
    given_name?: string;
    family_name?: string;
    preferred_username?: string;
  };

  const identities = Array.isArray(user.identities) ? user.identities : [];
  const identityData = identities.find((identity) => identity.provider === "google")
    ?.identity_data as
    | {
        name?: string;
        full_name?: string;
        given_name?: string;
        family_name?: string;
      }
    | undefined;

  const mergedGivenFamilyName = [
    pickFirstText([metadata?.given_name, identityData?.given_name]),
    pickFirstText([metadata?.family_name, identityData?.family_name]),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    pickFirstText([
      metadata?.full_name,
      metadata?.name,
      identityData?.full_name,
      identityData?.name,
      mergedGivenFamilyName,
      metadata?.preferred_username,
      user.email,
    ]) ?? "Google 사용자"
  );
}

export default function CalendarPage() {

  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState<EventFormState>({
    companyName: "",
    companyTicker: "",
    companyMarket: "",
    start: "",
    end: "",
    notes: "",
    color: DEFAULT_COLOR,
  });
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyResults, setCompanyResults] = useState<CompanySearchResult[]>(
    [],
  );
  const [isCompanyLoading, setIsCompanyLoading] = useState(false);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary>({
    attending: 0,
    maybe: 0,
    not_attending: 0,
  });
  const [myAttendance, setMyAttendance] = useState<AttendanceStatus | null>(null);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);
  const [isAttendanceSaving, setIsAttendanceSaving] = useState(false);
  const [attendanceMembers, setAttendanceMembers] = useState<AttendanceMember[]>([]);

  const calendarEvents = useMemo<EventInput[]>(() => {
    return events.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end ?? undefined,
      backgroundColor: event.color,
      borderColor: event.color,
      textColor: getReadableTextColor(event.color || DEFAULT_COLOR),
      extendedProps: { notes: event.notes },
    }));
  }, [events]);

  const resetForm = () => {
    setForm({
      companyName: "",
      companyTicker: "",
      companyMarket: "",
      start: "",
      end: "",
      notes: "",
      color: DEFAULT_COLOR,
    });
    setEditingId(null);
    setCompanyQuery("");
    setCompanyResults([]);
    setAttendanceSummary({ attending: 0, maybe: 0, not_attending: 0 });
    setMyAttendance(null);
    setIsAttendanceLoading(false);
    setIsAttendanceSaving(false);
    setAttendanceMembers([]);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const loadEvents = async () => {
    const response = await fetch("/api/events", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to load events");
    }

    const data = (await response.json()) as CalendarEvent[];
    setEvents(data);
  };

  useEffect(() => {
    const syncAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error(error);
        }

        setUser(session?.user ?? null);
      } catch (error) {
        console.error(error);
        setUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    void syncAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthError(null);
      setIsAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setEvents([]);
      setIsLoading(false);
      return;
    }

    const run = async () => {
      setIsLoading(true);

      try {
        await loadEvents();
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, [user]);

  const signInWithGoogle = async () => {
    setIsSigningIn(true);
    setAuthError(null);

    try {
      const redirectTo = `${window.location.origin}/calendar`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        throw error;
      }

      if (!data?.url) {
        throw new Error("Google 로그인 URL을 생성하지 못했습니다.");
      }

      window.location.assign(data.url);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : "알 수 없는 인증 오류가 발생했습니다.";
      setAuthError(getGoogleAuthHint(message));
      setIsSigningIn(false);
    }
  };

  const signOut = async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error(error);
      alert("로그아웃에 실패했습니다.");
    }
  };

  const openCreateModal = (start: Date, end?: Date) => {
    const suggestedStart = (() => {
      if (end) return start;

      const dayEvents = events
        .map((event) => new Date(event.start))
        .filter((eventStart) => !Number.isNaN(eventStart.getTime()))
        .filter((eventStart) => isSameLocalDate(eventStart, start))
        .sort((a, b) => a.getTime() - b.getTime());

      const latestStart = dayEvents.at(-1);
      if (!latestStart) return start;

      return addHours(latestStart, 1);
    })();

    setEditingId(null);
    setForm({
      companyName: "",
      companyTicker: "",
      companyMarket: "",
      start: toDateTimeLocal(suggestedStart),
      end: toDateTimeLocal(end ?? addHours(suggestedStart, 1)),
      notes: "",
      color: DEFAULT_COLOR,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (eventId: string) => {
    const target = events.find((event) => event.id === eventId);
    if (!target) return;

    setEditingId(target.id);
    const companyMatch =
      target.title.match(/^기업 탐방\s*-\s*(.+)\s*\((\d+)\.KRX\)$/) ?? null;
    const companyName = companyMatch?.[1] ?? "";
    const companyTicker = companyMatch?.[2] ?? "";

    setForm({
      companyName,
      companyTicker,
      companyMarket: companyTicker ? "KRX" : "",
      start: toDateTimeLocal(target.start),
      end: toDateTimeLocal(target.end),
      notes: stripGoogleFinanceLines(target.notes),
      color: target.color || DEFAULT_COLOR,
    });
    setCompanyQuery(companyName);
    setIsModalOpen(true);
    void loadAttendance(target.id);
  };

  useEffect(() => {
    const trimmedQuery = companyQuery.trim();

    if (trimmedQuery.length < 2) {
      setCompanyResults([]);
      setIsCompanyLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      const run = async () => {
        setIsCompanyLoading(true);

        try {
          const response = await fetch(
            `/api/companies?query=${encodeURIComponent(trimmedQuery)}`,
            {
              method: "GET",
              cache: "no-store",
            },
          );

          if (!response.ok) {
            throw new Error("Failed to search companies");
          }

          const data = (await response.json()) as CompaniesApiResponse;
          setCompanyResults((data.companies ?? []).slice(0, 10));
        } catch (error) {
          console.error(error);
          setCompanyResults([]);
        } finally {
          setIsCompanyLoading(false);
        }
      };

      void run();
    }, 250);

    return () => clearTimeout(timer);
  }, [companyQuery]);

  const handleSelectCompany = (company: CompanySearchResult) => {
    setForm((prev) => ({
      ...prev,
      companyName: company.name_kr,
      companyTicker: company.ticker,
      companyMarket: company.market ?? "KRX",
    }));
    setCompanyQuery(company.name_kr);
    setCompanyResults([]);
  };

  const loadAttendance = async (eventId: string) => {
    if (!user?.id) return;

    setIsAttendanceLoading(true);

    try {
      const response = await fetch(`/api/events/${eventId}/attendance?userId=${encodeURIComponent(user.id)}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load attendance");
      }

      const data = (await response.json()) as AttendanceApiResponse;
      setAttendanceSummary(data.summary);
      setMyAttendance(data.myStatus);
      setAttendanceMembers(data.attendees ?? []);
    } catch (error) {
      console.error(error);
      setAttendanceSummary({ attending: 0, maybe: 0, not_attending: 0 });
      setMyAttendance(null);
      setAttendanceMembers([]);
    } finally {
      setIsAttendanceLoading(false);
    }
  };

  const handleAttendanceSelect = async (action: "attend" | "cancel") => {
    if (!editingId || !user?.id) return;

    setIsAttendanceSaving(true);

    try {
      const response = await fetch(`/api/events/${editingId}/attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          userName: getDisplayName(user),
          userEmail: user.email ?? null,
          action,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update attendance");
      }

      const data = (await response.json()) as AttendanceApiResponse;
      setAttendanceSummary(data.summary);
      setMyAttendance(data.myStatus);
      setAttendanceMembers(data.attendees ?? []);
    } catch (error) {
      console.error(error);
      alert("참석 여부 저장에 실패했습니다.");
    } finally {
      setIsAttendanceSaving(false);
    }
  };

  const handleDateClick = (info: { date: Date }) => {
    openCreateModal(info.date);
  };

  const handleSelect = (info: DateSelectArg) => {
    openCreateModal(info.start, info.end);
    info.view.calendar.unselect();
  };

  const handleEventClick = (info: EventClickArg) => {
    openEditModal(info.event.id);
  };

  const handleSave = async () => {
    const trimmedCompanyName = form.companyName.trim();
    const trimmedCompanyTicker = form.companyTicker.trim();
    const startIso = toIso(form.start);
    const endIso = form.end ? toIso(form.end) : null;

    if (!trimmedCompanyName || !trimmedCompanyTicker || !startIso) return;

    const generatedTitle = `기업 탐방 - ${trimmedCompanyName} (${trimmedCompanyTicker}.KRX)`;
    const generatedNotes = form.notes.trim();

    const payload = {
      title: generatedTitle,
      start: startIso,
      end: endIso,
      notes: generatedNotes,
      color: form.color || DEFAULT_COLOR,
    };

    try {
      const url = editingId ? `/api/events/${editingId}` : "/api/events";
      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to save event");
      }

      const saved = (await response.json()) as CalendarEvent;
      setEvents((prev) => {
        if (!editingId) {
          return [...prev, saved];
        }

        return prev.map((event) => (event.id === editingId ? saved : event));
      });

      closeModal();
    } catch (error) {
      console.error(error);
      alert("이벤트 저장에 실패했습니다.");
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    if (!window.confirm("이 이벤트를 삭제할까요?")) return;

    try {
      const response = await fetch(`/api/events/${editingId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete event");
      }

      setEvents((prev) => prev.filter((event) => event.id !== editingId));
      closeModal();
    } catch (error) {
      console.error(error);
      alert("이벤트 삭제에 실패했습니다.");
    }
  };

  const updateEventTime = async (info: EventTimeChangeArg) => {
    const current = events.find((event) => event.id === info.event.id);
    if (!current || !info.event.start) return;

    const payload = {
      title: current.title,
      start: info.event.start.toISOString(),
      end: info.event.end ? info.event.end.toISOString() : null,
      notes: current.notes,
      color: current.color,
    };

    try {
      const response = await fetch(`/api/events/${info.event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to update event time");
      }

      const updated = (await response.json()) as CalendarEvent;
      setEvents((prev) =>
        prev.map((event) => (event.id === updated.id ? updated : event)),
      );
    } catch (error) {
      console.error(error);
      info.revert();
      alert("일정 시간 변경에 실패했습니다.");
    }
  };

  const handleEventDrop = async (info: EventDropArg) => {
    await updateEventTime(info);
  };

  const handleEventResize = async (info: EventTimeChangeArg) => {
    await updateEventTime(info);
  };

  const isSaveDisabled =
    !form.companyName.trim() || !form.companyTicker.trim() || !form.start;

  return (
    <main className="calendar-page" style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "16px" }}>
        Calendar
      </h1>

      {isAuthLoading ? <p>로그인 상태를 확인하는 중...</p> : null}

      {!user ? (
        <section
          style={{
            maxWidth: "420px",
            border: "1px solid #d1d5db",
            borderRadius: "12px",
            padding: "16px",
            display: "grid",
            gap: "12px",
            background: "#fff",
            color: "#111827",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>
            Google 계정으로 로그인
          </h2>
          <p style={{ margin: 0 }}>
            일정을 보거나 수정하려면 먼저 로그인해 주세요.
          </p>
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={isSigningIn}
            style={{
              border: "1px solid #2563eb",
              background: isSigningIn ? "#93c5fd" : "#2563eb",
              color: "#fff",
              borderRadius: "8px",
              padding: "10px 14px",
              cursor: isSigningIn ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {isSigningIn ? "Google로 이동 중..." : "Google로 로그인"}
          </button>

          {authError ? (
            <p
              style={{
                margin: 0,
                padding: "10px 12px",
                borderRadius: "8px",
                background: "#fef2f2",
                color: "#b91c1c",
                fontSize: "14px",
                lineHeight: 1.5,
              }}
            >
              {authError}
              <br />
              <span style={{ fontSize: "12px", color: "#7f1d1d" }}>
                현재 연결된 Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL}
              </span>
            </p>
          ) : null}
        </section>
      ) : null}

      {user ? (
        <div
          style={{
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <p style={{ margin: 0, color: "#374151" }}>
            로그인됨: <strong>{getDisplayName(user)}</strong>
          </p>
          <button
            type="button"
            onClick={signOut}
            style={{
              border: "1px solid #d1d5db",
              background: "#fff",
              borderRadius: "8px",
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            로그아웃
          </button>
        </div>
      ) : null}

      {!user ? null : (
        <>

      {isLoading ? <p>불러오는 중...</p> : null}

      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        buttonText={{
          today: "오늘",
          month: "월",
          week: "주",
          day: "일",
        }}
        selectable
        editable
        selectMirror
        dateClick={handleDateClick}
        select={handleSelect}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        events={calendarEvents}
        height="auto"
      />

      {isModalOpen ? (
        <div
          className="calendar-modal-overlay event-modal"
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 1000,
            color: "#000",
          }}
        >
          <div
            className="calendar-modal"
            style={{
              width: "100%",
              maxWidth: "460px",
              background: "#fff",
              border: "1px solid #d1d5db",
              borderRadius: "12px",
              padding: "20px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
              display: "grid",
              gap: "10px",
            }}
          >
            <h2
              className="calendar-modal-title"
              style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}
            >
              {editingId ? "기업 탐방 일정 수정" : "기업 탐방 일정 추가"}
            </h2>

            {editingId ? (
              <section
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  padding: "10px",
                  display: "grid",
                  gap: "10px",
                }}
              >
                <strong style={{ fontSize: "14px" }}>팀 참석</strong>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "10px",
                    alignItems: "start",
                  }}
                >
                  <div style={{ display: "grid", gap: "8px" }}>
                    <p style={{ margin: 0, fontSize: "13px", color: "#374151" }}>
                      현재 참석자 {attendanceSummary.attending}명
                    </p>
                    {isAttendanceLoading ? (
                      <p style={{ margin: 0, fontSize: "13px" }}>참석 정보를 불러오는 중...</p>
                    ) : null}
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        disabled={isAttendanceSaving || myAttendance === "attending"}
                        onClick={() => handleAttendanceSelect("attend")}
                        style={{
                          border: "1px solid #2563eb",
                          background: myAttendance === "attending" ? "#bfdbfe" : "#2563eb",
                          color: myAttendance === "attending" ? "#1e3a8a" : "#ffffff",
                          borderRadius: "8px",
                          padding: "6px 10px",
                          cursor:
                            isAttendanceSaving || myAttendance === "attending"
                              ? "not-allowed"
                              : "pointer",
                          fontWeight: 700,
                        }}
                      >
                        참석하기
                      </button>
                      <button
                        type="button"
                        disabled={isAttendanceSaving || myAttendance !== "attending"}
                        onClick={() => handleAttendanceSelect("cancel")}
                        style={{
                          border: "1px solid #d97706",
                          background: myAttendance === "attending" ? "#ffedd5" : "#ffffff",
                          color: "#9a3412",
                          borderRadius: "8px",
                          padding: "6px 10px",
                          cursor:
                            isAttendanceSaving || myAttendance !== "attending"
                              ? "not-allowed"
                              : "pointer",
                          fontWeight: 600,
                        }}
                      >
                        참석 취소
                      </button>
                    </div>
                  </div>

                  <aside
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      padding: "8px",
                      background: "#f9fafb",
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "13px" }}>
                      참석자 명단
                    </p>
                    <ul style={{ margin: "8px 0 0", paddingLeft: "18px", fontSize: "13px" }}>
                      {attendanceMembers.length > 0 ? (
                        attendanceMembers.map((member) => (
                          <li key={member.userId}>
                            {member.userName}
                          </li>
                        ))
                      ) : (
                        <li style={{ color: "#6b7280" }}>아직 참석자가 없습니다.</li>
                      )}
                    </ul>
                  </aside>
                </div>
              </section>
            ) : null}

            <label className="calendar-modal-label">
              상장사 검색 (KOSPI/KOSDAQ) *
              <input
                className="calendar-modal-input"
                type="text"
                value={companyQuery}
                onChange={(e) => {
                  const nextQuery = e.target.value;
                  setCompanyQuery(nextQuery);
                  setForm((prev) => ({
                    ...prev,
                    companyName: "",
                    companyTicker: "",
                    companyMarket: "",
                  }));
                }}
                placeholder={
                  form.companyName && form.companyTicker
                    ? `${form.companyName} (${form.companyTicker}, ${form.companyMarket})`
                    : "예: 삼성전자, 카카오"
                }
                style={{ width: "100%", padding: "8px", marginTop: "4px" }}
              />
            </label>

            {isCompanyLoading ? <p style={{ margin: 0 }}>기업 검색 중...</p> : null}

            {companyResults.length > 0 ? (
              <div
                style={{
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  maxHeight: "160px",
                  overflowY: "auto",
                }}
              >
                {companyResults.map((company) => (
                  <button
                    key={`${company.market}-${company.ticker}`}
                    type="button"
                    onClick={() => handleSelectCompany(company)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      background: "#fff",
                      padding: "8px 10px",
                      cursor: "pointer",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    {company.name_kr} ({company.ticker}, {company.market ?? "KRX"})
                  </button>
                ))}
              </div>
            ) : null}

            {!isCompanyLoading &&
            companyQuery.trim().length >= 2 &&
            companyResults.length === 0 ? (
              <p style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>
                검색 결과가 없습니다. 회사명을 더 정확히 입력해 주세요.
              </p>
            ) : null}

            <label className="calendar-modal-label">
              시작
              <input
                className="calendar-modal-input"
                type="datetime-local"
                value={form.start}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, start: e.target.value }))
                }
                style={{ width: "100%", padding: "8px", marginTop: "4px" }}
              />
            </label>

            <label className="calendar-modal-label">
              종료
              <input
                className="calendar-modal-input"
                type="datetime-local"
                value={form.end}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, end: e.target.value }))
                }
                style={{ width: "100%", padding: "8px", marginTop: "4px" }}
              />
            </label>

            {editingId ? (
              <section
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  padding: "10px",
                  display: "grid",
                  gap: "8px",
                }}
              >
                <strong style={{ fontSize: "14px" }}>팀 참석 여부</strong>
                <p style={{ margin: 0, fontSize: "13px", color: "#374151" }}>
                  참석 {attendanceSummary.attending}명 · 보류 {attendanceSummary.maybe}명 · 불참 {attendanceSummary.not_attending}명
                </p>
                {isAttendanceLoading ? (
                  <p style={{ margin: 0, fontSize: "13px" }}>참석 정보를 불러오는 중...</p>
                ) : null}
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
  type="button"
  disabled={isAttendanceSaving}
  onClick={() =>
    handleAttendanceSelect(myAttendance === "attending" ? "cancel" : "attend")
  }
  style={{
    border: "1px solid #d1d5db",
    background: "#fff",
    borderRadius: "8px",
    padding: "6px 10px",
    cursor: isAttendanceSaving ? "not-allowed" : "pointer",
    fontWeight: 500,
  }}
>
  {myAttendance === "attending" ? "참석 취소" : "참석하기"}
</button>  
                </div>
              </section>
            ) : null}

            <label className="calendar-modal-label">
              메모
              <textarea
                className="calendar-modal-textarea"
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="메모"
                rows={3}
                style={{ width: "100%", padding: "8px", marginTop: "4px" }}
              />
            </label>

            <label className="calendar-modal-label">
              색상
              <input
                className="calendar-modal-input"
                type="color"
                value={form.color}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, color: e.target.value }))
                }
                style={{ width: "100%", height: "40px", marginTop: "4px" }}
              />
            </label>

            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "flex-end",
                marginTop: "8px",
              }}
            >
              {editingId ? (
                <button
                  className="calendar-modal-button"
                  type="button"
                  onClick={handleDelete}
                  style={{
                    border: "1px solid #dc2626",
                    background: "#fee2e2",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  삭제
                </button>
              ) : null}

              <button
                className="calendar-modal-button"
                type="button"
                onClick={closeModal}
                style={{
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                취소
              </button>

              <button
                className="calendar-modal-button"
                type="button"
                onClick={handleSave}
                disabled={isSaveDisabled}
                style={{
                  border: "1px solid #2563eb",
                  background: isSaveDisabled ? "#93c5fd" : "#2563eb",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  cursor: isSaveDisabled ? "not-allowed" : "pointer",
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      ) : null}
        </>
      )}
    </main>
  );
}
