"use client";

import { useEffect, useState } from "react";
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

export default function UniversePage() {
  const [events, setEvents] = useState<EventInput[]>([]);
  const [tickers, setTickers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [evRes, tkRes] = await Promise.all([
          fetch("/api/universe/events", { cache: "no-store" }),
          fetch("/api/universe", { cache: "no-store" }),
        ]);
        const evData = (await evRes.json()) as UniverseEvent[];
        const tkData = (await tkRes.json()) as UniverseTicker[];

        const tkList = tkData.map((t) => t.ticker);
        setTickers(tkList);

        const colorMap = new Map<string, string>(
          tkList.map((t, i) => [t, TICKER_COLORS[i % TICKER_COLORS.length]])
        );

        setEvents(
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

  return (
    <main style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>유니버스</h1>

      {tickers.length > 0 && (
        <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "20px" }}>
          팔로업 기업 {tickers.length}개 · 타임라인 일정 {events.length}건
        </p>
      )}

      {isLoading ? (
        <p style={{ color: "#6b7280" }}>데이터를 불러오는 중...</p>
      ) : tickers.length === 0 ? (
        <div style={{ border: "1px dashed #d1d5db", borderRadius: "12px", padding: "60px 16px", textAlign: "center", color: "#9ca3af", fontSize: "14px" }}>
          팔로업하기 버튼을 눌러 기업을 추가하면 타임라인이 표시됩니다.
        </div>
      ) : (
        <div className="calendar-page">
          <FullCalendar
            plugins={[dayGridPlugin, listPlugin]}
            initialView="dayGridMonth"
            locale={koLocale}
            events={events}
            headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,listYear" }}
            height="auto"
            eventDisplay="block"
            displayEventTime={false}
          />
        </div>
      )}
    </main>
  );
}
