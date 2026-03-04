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
  companyName: string;
  companyTicker: string;
  companyMarket: string;
  companyFinanceUrl: string;
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

function isSameLocalDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getReadableTextColor(hexColor: string): "#111827" | "#ffffff" {
  const hex = hexColor.replace("#", "").trim();
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return "#ffffff";
  }

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;

  return brightness >= 150 ? "#111827" : "#ffffff";
}

export default function CalendarPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState<EventFormState>({
    companyName: "",
    companyTicker: "",
    companyMarket: "",
    companyFinanceUrl: "",
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

  const userDisplayName = useMemo(() => {
    if (!user) return "Google 사용자";

    const metadata = user.user_metadata as Record<string, unknown> | undefined;
    const identities = Array.isArray(user.identities)
      ? (user.identities as Array<{
          identity_data?: Record<string, unknown> | null;
        }>)
      : [];
    const identityData = identities
      .map((identity) => identity.identity_data)
      .filter(
        (value): value is Record<string, unknown> =>
          Boolean(value) && typeof value === "object",
      );

    const candidateNames = [
      metadata?.name,
      metadata?.full_name,
      metadata?.preferred_username,
      ...identityData.flatMap((identity) => [
        identity.name,
        identity.full_name,
        identity.given_name,
        identity.nickname,
        identity.preferred_username,
      ]),
      user.email,
    ];

    const displayName = candidateNames.find(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    );

    return displayName ?? "Google 사용자";
  }, [user]);

  const resetForm = () => {
    setForm({
      companyName: "",
      companyTicker: "",
      companyMarket: "",
      companyFinanceUrl: "",
      start: "",
      end: "",
      notes: "",
      color: DEFAULT_COLOR,
    });
    setEditingId(null);
    setCompanyQuery("");
    setCompanyResults([]);
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
    const redirectTo = `${window.location.origin}/calendar`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        scopes: "openid email profile",
      },
    });

    if (error) {
      console.error(error);
      alert("Google 로그인에 실패했습니다.");
    }
  };

  const signOut = async () => {
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
      companyFinanceUrl: "",
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
      companyFinanceUrl: companyTicker
        ? `https://www.google.com/finance/quote/${companyTicker}:KRX`
        : "",
      start: toDateTimeLocal(target.start),
      end: toDateTimeLocal(target.end),
      notes: target.notes,
      color: target.color || DEFAULT_COLOR,
    });
    setCompanyQuery(companyName);
    setIsModalOpen(true);
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
      companyFinanceUrl: `https://www.google.com/finance/quote/${company.ticker}:KRX`,
    }));
    setCompanyQuery(company.name_kr);
    setCompanyResults([]);
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
    const generatedNotes = [
      form.companyFinanceUrl
        ? `Google Finance: ${form.companyFinanceUrl}`
        : undefined,
      form.notes.trim(),
    ]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join("\n");

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
            style={{
              border: "1px solid #2563eb",
              background: "#2563eb",
              color: "#fff",
              borderRadius: "8px",
              padding: "10px 14px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Google로 로그인
          </button>
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
            로그인됨: <strong>{userDisplayName}</strong>
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
                    companyFinanceUrl: "",
                  }));
                }}
                placeholder="예: 삼성전자, 카카오"
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
              선택된 기업
              <input
                className="calendar-modal-input"
                type="text"
                value={
                  form.companyName && form.companyTicker
                    ? `${form.companyName} (${form.companyTicker}, ${form.companyMarket})`
                    : ""
                }
                readOnly
                placeholder="기업을 검색해서 선택해 주세요"
                style={{ width: "100%", padding: "8px", marginTop: "4px" }}
              />
            </label>

            {form.companyFinanceUrl ? (
              <p style={{ margin: 0, color: "#1d4ed8", fontSize: "13px" }}>
                Google Finance: {form.companyFinanceUrl}
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
