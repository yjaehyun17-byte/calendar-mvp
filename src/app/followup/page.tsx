"use client";

import { useEffect, useState } from "react";

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
};

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

  return (
    <main style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "20px" }}>팔로업</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
        <section>
          <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "12px", color: "#374151" }}>
            수익률 트래킹
          </h2>

          {isLoading ? (
            <p style={{ color: "#6b7280" }}>데이터를 불러오는 중...</p>
          ) : items.length === 0 ? (
            <p style={{ color: "#6b7280" }}>팔로업할 일정이 없습니다.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "14px",
            }}
          >
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                {["기업명", "유형", "방문일", "경과일", "방문시 주가", "현재 주가", "수익률"].map(
                  (col) => (
                    <th
                      key={col}
                      style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        fontWeight: 600,
                        color: "#374151",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const ret = item.returnPct;
                const retColor =
                  ret === null ? "#6b7280" : ret >= 0 ? "#16a34a" : "#dc2626";

                return (
                  <tr
                    key={item.id}
                    style={{ borderBottom: "1px solid #e5e7eb" }}
                  >
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                      {item.companyName}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "999px",
                          fontSize: "12px",
                          fontWeight: 700,
                          background: item.eventType === "탐방" ? "#fee2e2" : "#dbeafe",
                          color: item.eventType === "탐방" ? "#dc2626" : "#2563eb",
                        }}
                      >
                        {item.eventType}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#374151" }}>
                      {formatDate(item.eventDate)}
                    </td>
                    <td style={{ padding: "10px 14px", color: "#374151" }}>
                      {item.daysAgo >= 0 ? `D+${item.daysAgo}` : `D${item.daysAgo}`}
                    </td>
                    <td style={{ padding: "10px 14px", color: "#374151" }}>
                      {formatPrice(item.priceAtEvent)}
                    </td>
                    <td style={{ padding: "10px 14px", color: "#374151" }}>
                      {formatPrice(item.currentPrice)}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontWeight: 700,
                        color: retColor,
                      }}
                    >
                      {formatReturn(ret)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
            </div>
          )}
        </section>

        <section>
          {/* 추후 기능 추가 예정 */}
        </section>
      </div>
    </main>
  );
}
