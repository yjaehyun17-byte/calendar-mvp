"use client";

import { useEffect, useState } from "react";

type PricePoint = { date: string; close: number };
type FinancialRow = { period: string; revenue: number | null; operatingIncome: number | null; netIncome: number | null; eps: number | null };
type EstimateRow = { period: string; label: string; endDate: string | null; epsAvg: number | null; epsLow: number | null; epsHigh: number | null; analysts: number | null; revenueAvg: number | null };

type CompanyDetail = {
  companyName: string;
  ticker: string;
  market: string;
  currentPrice: number | null;
  changePct: number | null;
  priceHistory: PricePoint[];
  annualFinancials: FinancialRow[];
  quarterlyFinancials: FinancialRow[];
  estimates: EstimateRow[];
};

function formatKRW(v: number | null): string {
  if (v === null) return "-";
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000_000) return `${(v / 1_000_000_000_000).toFixed(1)}조`;
  if (abs >= 100_000_000) return `${Math.round(v / 100_000_000)}억`;
  return v.toLocaleString("ko-KR");
}

function formatEPS(v: number | null): string {
  if (v === null) return "-";
  return v.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

function PriceChart({ data }: { data: PricePoint[] }) {
  if (data.length < 2) return <p style={{ color: "#9ca3af", fontSize: "13px" }}>차트 데이터 없음</p>;

  const W = 400;
  const H = 110;
  const PAD = { top: 8, right: 8, bottom: 18, left: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const closes = data.map((d) => d.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;

  const x = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
  const y = (v: number) => PAD.top + (1 - (v - min) / range) * innerH;

  const pathD = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.close).toFixed(1)}`).join(" ");
  const first = closes[0];
  const last = closes[closes.length - 1];
  const color = last >= first ? "#dc2626" : "#2563eb";

  // Show ~4 date labels
  const labelIndices = [0, Math.floor(data.length / 3), Math.floor((data.length * 2) / 3), data.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {/* Y axis labels */}
      <text x={PAD.left - 4} y={PAD.top + 6} textAnchor="end" fontSize="9" fill="#6b7280">{max.toLocaleString("ko-KR")}</text>
      <text x={PAD.left - 4} y={H - PAD.bottom} textAnchor="end" fontSize="9" fill="#6b7280">{min.toLocaleString("ko-KR")}</text>
      {/* Baseline */}
      <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="#e5e7eb" strokeWidth="1" />
      {/* Price line */}
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" />
      {/* X date labels */}
      {labelIndices.map((idx) => (
        <text key={idx} x={x(idx)} y={H - 4} textAnchor="middle" fontSize="8" fill="#9ca3af">
          {data[idx].date.slice(5)}
        </text>
      ))}
    </svg>
  );
}

function FinancialsTable({ rows, title }: { rows: FinancialRow[]; title: string }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "13px" }}>{title}</p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              <th style={thStyle}>기간</th>
              <th style={thStyle}>매출</th>
              <th style={thStyle}>영업이익</th>
              <th style={thStyle}>순이익</th>
              <th style={thStyle}>EPS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.period} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={tdStyle}>{r.period}</td>
                <td style={tdStyle}>{formatKRW(r.revenue)}</td>
                <td style={{ ...tdStyle, color: r.operatingIncome !== null ? (r.operatingIncome >= 0 ? "#dc2626" : "#2563eb") : "#6b7280" }}>{formatKRW(r.operatingIncome)}</td>
                <td style={{ ...tdStyle, color: r.netIncome !== null ? (r.netIncome >= 0 ? "#dc2626" : "#2563eb") : "#6b7280" }}>{formatKRW(r.netIncome)}</td>
                <td style={tdStyle}>{formatEPS(r.eps)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EstimatesTable({ rows }: { rows: EstimateRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "13px" }}>실적 추정치</p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              <th style={thStyle}>기간</th>
              <th style={thStyle}>매출 추정</th>
              <th style={thStyle}>EPS 추정</th>
              <th style={thStyle}>EPS 범위</th>
              <th style={thStyle}>애널리스트</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.period} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={tdStyle}><span style={{ fontWeight: 600 }}>{r.label}</span>{r.endDate && <span style={{ color: "#9ca3af", marginLeft: 4 }}>({r.endDate.slice(0, 7)})</span>}</td>
                <td style={tdStyle}>{formatKRW(r.revenueAvg)}</td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{formatEPS(r.epsAvg)}</td>
                <td style={{ ...tdStyle, color: "#6b7280" }}>{r.epsLow !== null && r.epsHigh !== null ? `${formatEPS(r.epsLow)} ~ ${formatEPS(r.epsHigh)}` : "-"}</td>
                <td style={tdStyle}>{r.analysts ?? "-"}명</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: "6px 8px", textAlign: "left", fontWeight: 600, color: "#374151", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "6px 8px", color: "#374151", whiteSpace: "nowrap" };

export default function CompanyPanel({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<"annual" | "quarterly">("annual");

  useEffect(() => {
    setIsLoading(true);
    setDetail(null);
    fetch(`/api/company-detail?ticker=${encodeURIComponent(ticker)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setDetail(d as CompanyDetail))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [ticker]);

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", display: "grid", gap: "14px", maxHeight: "80vh", overflowY: "auto" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          {isLoading ? (
            <p style={{ margin: 0, color: "#6b7280" }}>불러오는 중...</p>
          ) : detail ? (
            <>
              <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>{detail.companyName}</h2>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6b7280" }}>{detail.ticker} · {detail.market}</p>
              {detail.currentPrice !== null && (
                <p style={{ margin: "4px 0 0", fontSize: "16px", fontWeight: 700 }}>
                  {detail.currentPrice.toLocaleString("ko-KR")}원
                  {detail.changePct !== null && (
                    <span style={{ marginLeft: 8, fontSize: "13px", color: detail.changePct >= 0 ? "#dc2626" : "#2563eb" }}>
                      {detail.changePct >= 0 ? "+" : ""}{detail.changePct.toFixed(2)}%
                    </span>
                  )}
                </p>
              )}
            </>
          ) : null}
        </div>
        <button type="button" onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "18px", color: "#6b7280", lineHeight: 1 }}>✕</button>
      </div>

      {detail && (
        <>
          {/* 주가 차트 */}
          <div>
            <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "13px" }}>주가 차트 (1년)</p>
            <PriceChart data={detail.priceHistory} />
          </div>

          {/* 실적 탭 */}
          <div>
            <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
              {(["annual", "quarterly"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  style={{
                    padding: "3px 10px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: tab === t ? 700 : 400,
                    border: tab === t ? "2px solid #2563eb" : "1px solid #d1d5db",
                    background: tab === t ? "#eff6ff" : "#fff",
                    color: tab === t ? "#2563eb" : "#374151",
                    cursor: "pointer",
                  }}
                >
                  {t === "annual" ? "연간" : "분기"}
                </button>
              ))}
            </div>
            <FinancialsTable
              rows={tab === "annual" ? detail.annualFinancials : detail.quarterlyFinancials}
              title={tab === "annual" ? "연간 실적" : "분기 실적"}
            />
          </div>

          {/* 추정치 */}
          <EstimatesTable rows={detail.estimates} />
        </>
      )}
    </div>
  );
}
