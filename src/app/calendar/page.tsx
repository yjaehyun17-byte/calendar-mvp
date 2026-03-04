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

type EventFormState = {
  title: string;
  start: string;
  end: string;
  notes: string;
  color: string;
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

function getGoogleAuthHint(errorMessage: string): string {
  if (errorMessage.includes("Unsupported provider")) {
    return "Supabase에서 Google Provider가 비활성화되어 있습니다. Supabase Dashboard > Authentication > Providers > Google을 활성화하고 Client ID/Secret을 저장해 주세요.";
  }

  if (errorMessage.includes("redirect_to") || errorMessage.includes("redirect")) {
    return "Redirect URL 설정을 확인해 주세요. Supabase Authentication > URL Configuration의 Site URL/Redirect URLs에 현재 배포 URL을 추가해야 합니다.";
  }

  return "Supabase 인증 설정(Provider 활성화, Client ID/Secret, Redirect URL)을 확인해 주세요.";
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
    title: "",
    start: "",
    end: "",
    notes: "",
    color: DEFAULT_COLOR,
  });

  const calendarEvents = useMemo<EventInput[]>(() => {
    return events.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end ?? undefined,
      backgroundColor: event.color,
      borderColor: event.color,
      extendedProps: { notes: event.notes },
    }));
  }, [events]);

  const resetForm = () => {
    setForm({
      title: "",
      start: "",
      end: "",
      notes: "",
      color: DEFAULT_COLOR,
    });
    setEditingId(null);
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

    const redirectTo = `${window.location.origin}/calendar`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      console.error(error);
      setAuthError(getGoogleAuthHint(error.message));
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
    setEditingId(null);
    setForm({
      title: "",
      start: toDateTimeLocal(start),
      end: toDateTimeLocal(end ?? addHours(start, 1)),
      notes: "",
      color: DEFAULT_COLOR,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (eventId: string) => {
    const target = events.find((event) => event.id === eventId);
    if (!target) return;

    setEditingId(target.id);
    setForm({
      title: target.title,
      start: toDateTimeLocal(target.start),
      end: toDateTimeLocal(target.end),
      notes: target.notes,
      color: target.color || DEFAULT_COLOR,
    });
    setIsModalOpen(true);
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
    const trimmedTitle = form.title.trim();
    const startIso = toIso(form.start);
    const endIso = form.end ? toIso(form.end) : null;

    if (!trimmedTitle || !startIso) return;

    const payload = {
      title: trimmedTitle,
      start: startIso,
      end: endIso,
      notes: form.notes.trim(),
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

  const isSaveDisabled = !form.title.trim() || !form.start;

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
            로그인됨: <strong>{user.email ?? "Google 사용자"}</strong>
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
              {editingId ? "이벤트 수정" : "이벤트 추가"}
            </h2>

            <label className="calendar-modal-label">
              제목 *
              <input
                className="calendar-modal-input"
                type="text"
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="일정 제목"
                style={{ width: "100%", padding: "8px", marginTop: "4px" }}
              />
            </label>

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
