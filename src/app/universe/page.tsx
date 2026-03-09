"use client";

import { useEffect, useMemo, useState } from "react";
import MemoModal from "../components/MemoModal";
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

type ScheduleItem = {
  id: string;
  companyName: string;
  ticker: string;
  eventType: string;
  date: string;
};

type ChecklistItem = {
  id: string;
  ticker: string;
  companyName: string;
  content: string;
  checked: boolean;
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

const sectionStyle: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
  padding: "16px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 700,
  margin: "0 0 4px",
};

const sectionSubStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text-faint)",
  margin: "0 0 14px",
};

export default function UniversePage() {
  const [rawEvents, setRawEvents] = useState<UniverseEvent[]>([]);
  const [calEvents, setCalEvents] = useState<EventInput[]>([]);
  const [tickers, setTickers] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
  const [togglingCheckId, setTogglingCheckId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [memoTarget, setMemoTarget] = useState<{ ticker: string; companyName: string; defaultDate?: string } | null>(null);

  const { start: monthStart, end: monthEnd } = useMemo(() => getMonthRange(), []);

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
      if (isChecked) {
        setMemoTarget({ ticker: ev.ticker, companyName: ev.companyName, defaultDate: ev.date });
      }
    } finally {
      setTogglingId(null);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [evRes, tkRes, chkRes, schRes, clRes] = await Promise.all([
          fetch("/api/universe/events", { cache: "no-store" }),
          fetch("/api/universe", { cache: "no-store" }),
          fetch("/api/universe/checks", { cache: "no-store" }),
          fetch("/api/universe/schedule", { cache: "no-store" }),
          fetch("/api/universe/checklists", { cache: "no-store" }),
        ]);
        const evData = (await evRes.json()) as UniverseEvent[];
        const tkData = (await tkRes.json()) as UniverseTicker[];
        const chkData = (await chkRes.json()) as string[];
        const schData = (await schRes.json()) as ScheduleItem[];
        const clData = (await clRes.json()) as ChecklistItem[];

        const tkList = tkData.map((t) => t.ticker);
        setTickers(tkList);
        setRawEvents(evData);
        setChecked(new Set(chkData));
        setSchedule(schData);
        setChecklists(clData);

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

  const toggleChecklistItem = async (item: ChecklistItem) => {
    if (togglingCheckId) return;
    setTogglingCheckId(item.id);
    try {
      const res = await fetch("/api/checklists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, checked: !item.checked }),
      });
      const updated = (await res.json()) as ChecklistItem;
      setChecklists((prev) => prev.map((i) => (i.id === updated.id ? { ...updated, companyName: item.companyName } : i)));
      if (updated.checked) {
        setMemoTarget({ ticker: item.ticker, companyName: item.companyName });
      }
    } finally {
      setTogglingCheckId(null);
    }
  };

  // 체크리스트 기업별 그룹핑
  const checklistGrouped = useMemo(() => {
    const map = new Map<string, { companyName: string; items: ChecklistItem[] }>();
    checklists.forEach((item) => {
      const existing = map.get(item.ticker) ?? { companyName: item.companyName, items: [] };
      existing.items.push(item);
      map.set(item.ticker, existing);
    });
    return Array.from(map.values());
  }, [checklists]);

  // 이번달 주요일정 (타임라인) — 날짜별 그룹
  const monthEvents = useMemo(() =>
    rawEvents.filter((ev) => ev.date >= monthStart && ev.date <= monthEnd)
      .sort((a, b) => a.date.localeCompare(b.date)),
    [rawEvents, monthStart, monthEnd]
  );

  const monthGrouped = useMemo(() => {
    const map = new Map<string, UniverseEvent[]>();
    monthEvents.forEach((ev) => {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    });
    return Array.from(map.entries());
  }, [monthEvents]);

  // 이번달 팔로업일정 — 날짜별 그룹
  const scheduleGrouped = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    schedule.forEach((s) => {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [schedule]);

  return (
    <main style={{ padding: "24px" }}>
      {memoTarget && (
        <MemoModal
          ticker={memoTarget.ticker}
          companyName={memoTarget.companyName}
          defaultDate={memoTarget.defaultDate}
          onClose={() => setMemoTarget(null)}
        />
      )}
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>유니버스</h1>

      {tickers.length > 0 && (
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "20px" }}>
          팔로업 기업 {tickers.length}개 · 타임라인 일정 {calEvents.length}건
        </p>
      )}

      {isLoading ? (
        <p style={{ color: "var(--color-text-muted)" }}>데이터를 불러오는 중...</p>
      ) : tickers.length === 0 ? (
        <div style={{ border: "1px dashed var(--color-border-light)", borderRadius: "12px", padding: "60px 16px", textAlign: "center", color: "var(--color-text-faint)", fontSize: "14px" }}>
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

          {/* 오른쪽 컬럼 */}
          <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: "16px" }}>
            {/* 이번달 주요일정 */}
            <aside style={sectionStyle}>
              <h2 style={sectionTitleStyle}>이번달 주요일정</h2>
              <p style={sectionSubStyle}>{formatDateKo(monthStart)} – {formatDateKo(monthEnd)}</p>

              {monthGrouped.length === 0 ? (
                <p style={{ fontSize: "13px", color: "var(--color-text-faint)" }}>일정 없음</p>
              ) : (
                <div style={{ display: "grid", gap: "12px" }}>
                  {monthGrouped.map(([date, evs]) => (
                    <div key={date}>
                      <p style={{ fontSize: "12px", fontWeight: 700, color: "#2563eb", margin: "0 0 6px", borderBottom: "1px solid var(--color-border)", paddingBottom: "4px" }}>
                        {formatDateKo(date)}
                      </p>
                      <div style={{ display: "grid", gap: "6px" }}>
                        {evs.map((ev) => {
                          const isChecked = checked.has(ev.id);
                          return (
                            <label key={ev.id} style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: togglingId ? "wait" : "pointer" }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={togglingId === ev.id}
                                onChange={() => void toggleChecked(ev)}
                                style={{ marginTop: "2px", accentColor: "#2563eb", flexShrink: 0 }}
                              />
                              <div style={{ opacity: isChecked ? 0.4 : 1 }}>
                                <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: "var(--color-text-primary)", textDecoration: isChecked ? "line-through" : "none" }}>
                                  {ev.companyName}
                                </p>
                                <p style={{ margin: 0, fontSize: "11px", color: "var(--color-text-muted)", textDecoration: isChecked ? "line-through" : "none" }}>
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

            {/* 이번달 팔로업일정 — 기업별 체크리스트 */}
            <aside style={sectionStyle}>
              <h2 style={sectionTitleStyle}>이번달 팔로업일정</h2>
              <p style={sectionSubStyle}>기업별 체크리스트</p>

              {checklistGrouped.length === 0 ? (
                <p style={{ fontSize: "13px", color: "var(--color-text-faint)" }}>체크리스트 없음</p>
              ) : (
                <div style={{ display: "grid", gap: "14px" }}>
                  {checklistGrouped.map(({ companyName, items }) => (
                    <div key={companyName}>
                      <p style={{ fontSize: "12px", fontWeight: 700, color: "#7c3aed", margin: "0 0 6px", borderBottom: "1px solid var(--color-border)", paddingBottom: "4px" }}>
                        {companyName}
                      </p>
                      <div style={{ display: "grid", gap: "5px" }}>
                        {items.map((item) => (
                          <label
                            key={item.id}
                            style={{ display: "flex", alignItems: "center", gap: "7px", cursor: togglingCheckId ? "wait" : "pointer" }}
                          >
                            <input
                              type="checkbox"
                              checked={item.checked}
                              disabled={togglingCheckId === item.id}
                              onChange={() => void toggleChecklistItem(item)}
                              style={{ accentColor: "#7c3aed", flexShrink: 0 }}
                            />
                            <span style={{
                              fontSize: "12px",
                              color: item.checked ? "var(--color-text-faint)" : "var(--color-text-secondary)",
                              textDecoration: item.checked ? "line-through" : "none",
                            }}>
                              {item.content}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </aside>
          </div>
        </div>
      )}
    </main>
  );
}
