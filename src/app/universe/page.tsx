"use client";

import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import koLocale from "@fullcalendar/core/locales/ko";
import type { EventInput } from "@fullcalendar/core";

type UniverseEvent = {
  id: string;
  title: string;
  date: string;
  ticker: string;
  companyName: string;
  visitDate: string;
};

type UniverseTicker = { ticker: string; added_at: string };

const TICKER_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed",
  "#0891b2", "#be185d", "#15803d", "#c2410c", "#4338ca",
];

function getMonthRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

function formatDateKo(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

export default function UniversePage() {
  const [rawEvents, setRawEvents] = useState<UniverseEvent[]>([]);
  const [calEvents, setCalEvents] = useState<EventInput[]>([]);
  const [tickers, setTickers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const toggleChecked = async (ev: UniverseEvent) => {
    if (togglingId) return;
    setTogglingId(ev.id);
    try {
      const res = await fetch("/api/universe/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: ev.id, ticker: ev.ticker }),
      });
      const { checked: isChecked } = (await res.json()) as { checked: boolean };
      setChecked((prev) => {
        const next = new Set(prev);
        if (isChecked) next.add(ev.id);
        else next.delete(ev.id);
        return next;
      });
    } finally {
      setTogglingId(null);
    }
  };

  const { start: weekStart, end: weekEnd } = useMemo(() => getMonthRange(), []);

  useEffect(() => {
    const load = async () => {
      try {
        const [evRes, tkRes, chkRes] = await Promise.all([
          fetch("/api/universe/events", { cache: "no-store" }),
          fetch("/api/universe", { cache: "no-store" }),
          fetch("/api/universe/checks", { cache: "no-store" }),
        ]);
        const evData = (await evRes.json()) as UniverseEvent[];
        const tkData = (await tkRes.json()) as UniverseTicker[];
        const chkData = (await chkRes.json()) as string[];
        setChecked(new Set(chkData));

        const tkList = tkData.map((t) => t.ticker);
        setTickers(tkList);
        setRawEvents(evData);

        const colorMap = new Map<string, string>(
          tkList.map((t, i) => [t, TICKER_COLORS[i % TICKER_COLORS.length]])
        );

        setCalEvents(
          evData.map((ev) => ({
            id: ev.id,
            title: ev.title,
            date: ev.date,
            backgroundColor: colorMap.get(ev.ticker) ?? "#2563eb",
            borderColor: colorMap.get(ev.ticker) ?? "#2563eb",
            extendedProps: { ticker: ev.ticker, companyName: ev.companyName, visitDate: ev.visitDate },
          }))
        );
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  // 이번 주 일정 (월~일)
  const weekEvents = useMemo(() => {
    return rawEvents
      .filter((ev) => ev.date >= weekStart && ev.date <= weekEnd)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [rawEvents, weekStart, weekEnd]);

  // 날짜별 그룹핑
  const weekGrouped = useMemo(() => {
    const map = new Map<string, UniverseEvent[]>();
    weekEvents.forEach((ev) => {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    });
    return Array.from(map.entries());
  }, [weekEvents]);

  return (
    <main style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>유니버스</h1>

      {tickers.length > 0 && (
        <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "20px" }}>
          팔로업 기업 {tickers.length}개 · 타임라인 일정 {calEvents.length}건
        </p>
      )}

      {isLoading ? (
        <p style={{ color: "#6b7280" }}>데이터를 불러오는 중...</p>
      ) : tickers.length === 0 ? (
        <div style={{ border: "1px dashed #d1d5db", borderRadius: "12px", padding: "60px 16px", textAlign: "center", color: "#9ca3af", fontSize: "14px" }}>
          팔로업하기 버튼을 눌러 기업을 추가하면 타임라인이 표시됩니다.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px", alignItems: "start" }}>
          {/* 캘린더 */}
          <div className="calendar-page">
            <FullCalendar
              plugins={[dayGridPlugin, listPlugin]}
              initialView="dayGridMonth"
              locale={koLocale}
              events={calEvents}
              headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,listYear" }}
              height="auto"
              eventDisplay="block"
              displayEventTime={false}
            />
          </div>

          {/* 한주 주요 일정 */}
          <aside style={{ border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 4px" }}>이번달 주요일정</h2>
            <p style={{ fontSize: "12px", color: "#9ca3af", margin: "0 0 14px" }}>
              {formatDateKo(weekStart)} – {formatDateKo(weekEnd)}
            </p>

            {weekGrouped.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#9ca3af" }}>이번달 일정 없음</p>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {weekGrouped.map(([date, evs]) => (
                  <div key={date}>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "#2563eb", margin: "0 0 6px", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" }}>
                      {formatDateKo(date)}
                    </p>
                    <div style={{ display: "grid", gap: "6px" }}>
                      {evs.map((ev) => {
                        const isChecked = checked.has(ev.id);
                        return (
                          <label
                            key={ev.id}
                            style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: togglingId ? "wait" : "pointer" }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={togglingId === ev.id}
                              onChange={() => void toggleChecked(ev)}
                              style={{ marginTop: "2px", accentColor: "#2563eb", flexShrink: 0 }}
                            />
                            <div style={{ opacity: isChecked ? 0.4 : 1 }}>
                              <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: "#111827", textDecoration: isChecked ? "line-through" : "none" }}>
                                {ev.companyName}
                              </p>
                              <p style={{ margin: 0, fontSize: "11px", color: "#6b7280", textDecoration: isChecked ? "line-through" : "none" }}>
                                {ev.title.replace(`[${ev.companyName}] `, "")}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
