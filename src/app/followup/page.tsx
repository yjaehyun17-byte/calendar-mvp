"use client";

import { useEffect, useMemo, useState } from "react";
import CompanyPanel from "../components/CompanyPanel";

type FollowupItem = {
  id: string;
  companyName: string;
  ticker: string;
  eventType: "탐방" | "컨콜";
  eventDate: string;
  daysAgo: number;
  priceAtEvent: number | null;
  currentPrice: number | null;
  returnPct: number | null;
  notes: string;
  irName: string;
  irContact: string;
  irAddress: string;
};

type SortKey = keyof Pick<FollowupItem, "companyName" | "eventDate" | "daysAgo" | "priceAtEvent" | "currentPrice" | "returnPct">;
type SortDir = "asc" | "desc";

const COLUMNS: { label: string; key: SortKey }[] = [
  { label: "기업명", key: "companyName" },
  { label: "방문일", key: "eventDate" },
  { label: "경과일", key: "daysAgo" },
  { label: "방문시 주가", key: "priceAtEvent" },
  { label: "현재 주가", key: "currentPrice" },
  { label: "수익률", key: "returnPct" },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function formatPrice(price: number | null) {
  if (price === null) return "-";
  return price.toLocaleString("ko-KR") + "원";
}

function formatReturn(ret: number | null) {
  if (ret === null) return "-";
  const sign = ret >= 0 ? "+" : "";
  return `${sign}${ret.toFixed(2)}%`;
}

export default function FollowupPage() {
  const [items, setItems] = useState<FollowupItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("eventDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/followup", { cache: "no-store" });
        const data = (await res.json()) as FollowupItem[];
        setItems(data);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };


  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      let cmp = 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        cmp = aVal.localeCompare(bVal, "ko");
      } else {
        cmp = (aVal as number) < (bVal as number) ? -1 : (aVal as number) > (bVal as number) ? 1 : 0;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, sortKey, sortDir]);

  return (
    <main style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "20px" }}>팔로업</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
        <section>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-text-secondary)", marginBottom: "12px" }}>
            수익률 트래킹
          </h2>

          {isLoading ? (
            <p style={{ color: "var(--color-text-muted)" }}>데이터를 불러오는 중...</p>
          ) : items.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)" }}>팔로업할 일정이 없습니다.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "var(--color-bg-subtle)", borderBottom: "2px solid var(--color-border)" }}>
                    {COLUMNS.map(({ label, key }) => {
                      const isActive = sortKey === key;
                      const arrow = isActive ? (sortDir === "asc" ? " ▲" : " ▼") : " ↕";
                      return (
                        <th
                          key={key}
                          onClick={() => handleSort(key)}
                          style={{
                            padding: "10px 14px",
                            textAlign: "left",
                            fontWeight: 600,
                            color: isActive ? "#2563eb" : "var(--color-text-secondary)",
                            whiteSpace: "nowrap",
                            cursor: "pointer",
                            userSelect: "none",
                          }}
                        >
                          {label}
                          <span style={{ fontSize: "11px", opacity: isActive ? 1 : 0.4 }}>{arrow}</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item) => {
                    const ret = item.returnPct;
                    const retColor = ret === null ? "var(--color-text-muted)" : ret >= 0 ? "#dc2626" : "#2563eb";
                    return (
                      <tr key={item.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <td
                          onClick={() => setSelectedTicker(item.ticker === selectedTicker ? null : item.ticker)}
                          style={{ padding: "10px 14px", fontWeight: 600, cursor: "pointer", color: selectedTicker === item.ticker ? "#2563eb" : "inherit", textDecoration: selectedTicker === item.ticker ? "underline" : "none" }}
                        >
                          {item.companyName}
                        </td>
                        <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)" }}>{formatDate(item.eventDate)}</td>
                        <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)" }}>
                          {item.daysAgo >= 0 ? `D+${item.daysAgo}` : `D${item.daysAgo}`}
                        </td>
                        <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)" }}>{formatPrice(item.priceAtEvent)}</td>
                        <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)" }}>{formatPrice(item.currentPrice)}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: retColor }}>{formatReturn(ret)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          {selectedTicker ? (
            <CompanyPanel ticker={selectedTicker} onClose={() => setSelectedTicker(null)} />
          ) : (
            <div style={{ border: "1px dashed var(--color-border-light)", borderRadius: "12px", padding: "40px 16px", textAlign: "center", color: "var(--color-text-faint)", fontSize: "14px" }}>
              기업명을 클릭하면 상세 정보가 표시됩니다.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
