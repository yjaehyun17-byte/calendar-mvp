"use client";

import { useEffect, useState } from "react";

type PricePoint = { date: string; close: number };
type FinancialRow = { period: string; revenue: number | null; operatingIncome: number | null; netIncome: number | null; eps: number | null };
type EstimateRow = { id: string; ticker: string; period: string; revenue: number | null; operating_income: number | null; net_income: number | null; eps: number | null };

type CompanyDetail = {
  companyName: string;
  ticker: string;
  market: string;
  currentPrice: number | null;
  changePct: number | null;
  marketCap: number | null;
  priceHistory: PricePoint[];
  annualFinancials: FinancialRow[];
  quarterlyFinancials: FinancialRow[];
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

type ChartPeriod = "1d" | "1wk" | "1mo";

const PERIOD_LABELS: Record<ChartPeriod, string> = { "1d": "일봉", "1wk": "주봉", "1mo": "월봉" };

function formatChartDate(date: string, period: ChartPeriod): string {
  if (period === "1mo") return date.slice(0, 7); // YYYY-MM
  return date.slice(5); // MM-DD
}

function PriceChart({ data, period }: { data: PricePoint[]; period: ChartPeriod }) {
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
  const color = closes[closes.length - 1] >= closes[0] ? "#dc2626" : "#2563eb";
  const labelIndices = [0, Math.floor(data.length / 3), Math.floor((data.length * 2) / 3), data.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      <text x={PAD.left - 4} y={PAD.top + 6} textAnchor="end" fontSize="9" fill="#6b7280">{max.toLocaleString("ko-KR")}</text>
      <text x={PAD.left - 4} y={H - PAD.bottom} textAnchor="end" fontSize="9" fill="#6b7280">{min.toLocaleString("ko-KR")}</text>
      <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="#e5e7eb" strokeWidth="1" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" />
      {labelIndices.map((idx) => (
        <text key={idx} x={x(idx)} y={H - 4} textAnchor="middle" fontSize="8" fill="#9ca3af">
          {formatChartDate(data[idx].date, period)}
        </text>
      ))}
    </svg>
  );
}

function FinancialsTable({ rows, title }: { rows: FinancialRow[]; title: string }) {
  if (rows.length === 0) return <p style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>데이터 없음</p>;
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

const thStyle: React.CSSProperties = { padding: "6px 8px", textAlign: "left", fontWeight: 600, color: "#374151", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "6px 8px", color: "#374151", whiteSpace: "nowrap" };

function EstimatesSection({ ticker }: { ticker: string }) {
  const [rows, setRows] = useState<EstimateRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ period: "", revenue: "", operating_income: "", net_income: "", eps: "" });

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/estimates?ticker=${encodeURIComponent(ticker)}`, { cache: "no-store" });
      const data = (await res.json()) as EstimateRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, [ticker]);

  const handleSave = async () => {
    if (!form.period.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          period: form.period.trim(),
          revenue: form.revenue ? Number(form.revenue.replace(/,/g, "")) : null,
          operating_income: form.operating_income ? Number(form.operating_income.replace(/,/g, "")) : null,
          net_income: form.net_income ? Number(form.net_income.replace(/,/g, "")) : null,
          eps: form.eps ? Number(form.eps.replace(/,/g, "")) : null,
        }),
      });
      setForm({ period: "", revenue: "", operating_income: "", net_income: "", eps: "" });
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/estimates?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: "13px" }}>실적 추정치</p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", color: "#374151" }}
        >
          {showForm ? "취소" : "+ 추가"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "#f9fafb", borderRadius: "8px", padding: "10px", marginBottom: "8px", display: "grid", gap: "6px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <div>
              <label style={{ fontSize: "11px", color: "#6b7280" }}>기간 (예: 2025, 2025-Q1)</label>
              <input
                value={form.period}
                onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
                placeholder="2025"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#6b7280" }}>EPS (원)</label>
              <input
                value={form.eps}
                onChange={(e) => setForm((f) => ({ ...f, eps: e.target.value }))}
                placeholder="1234"
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
            <div>
              <label style={{ fontSize: "11px", color: "#6b7280" }}>매출 (억)</label>
              <input
                value={form.revenue}
                onChange={(e) => setForm((f) => ({ ...f, revenue: e.target.value }))}
                placeholder="100000000"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#6b7280" }}>영업이익 (억)</label>
              <input
                value={form.operating_income}
                onChange={(e) => setForm((f) => ({ ...f, operating_income: e.target.value }))}
                placeholder="10000000"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#6b7280" }}>순이익 (억)</label>
              <input
                value={form.net_income}
                onChange={(e) => setForm((f) => ({ ...f, net_income: e.target.value }))}
                placeholder="8000000"
                style={inputStyle}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !form.period.trim()}
            style={{ padding: "5px 12px", borderRadius: "6px", border: "none", background: "#2563eb", color: "#fff", fontSize: "12px", cursor: "pointer", fontWeight: 600, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      )}

      {isLoading ? (
        <p style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>불러오는 중...</p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>추정치 없음</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={thStyle}>기간</th>
                <th style={thStyle}>매출</th>
                <th style={thStyle}>영업이익</th>
                <th style={thStyle}>순이익</th>
                <th style={thStyle}>EPS</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={tdStyle}>{r.period}</td>
                  <td style={tdStyle}>{formatKRW(r.revenue)}</td>
                  <td style={{ ...tdStyle, color: r.operating_income !== null ? (r.operating_income >= 0 ? "#dc2626" : "#2563eb") : "#6b7280" }}>{formatKRW(r.operating_income)}</td>
                  <td style={{ ...tdStyle, color: r.net_income !== null ? (r.net_income >= 0 ? "#dc2626" : "#2563eb") : "#6b7280" }}>{formatKRW(r.net_income)}</td>
                  <td style={tdStyle}>{formatEPS(r.eps)}</td>
                  <td style={{ padding: "6px 4px" }}>
                    <button
                      type="button"
                      onClick={() => void handleDelete(r.id)}
                      style={{ fontSize: "10px", color: "#9ca3af", border: "none", background: "none", cursor: "pointer", padding: 0 }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "4px 6px",
  fontSize: "12px",
  border: "1px solid #d1d5db",
  borderRadius: "4px",
  boxSizing: "border-box",
};

type MemoRow = { id: string; ticker: string; visit_date: string; summary: string; details: string };

function MemosSection({ ticker }: { ticker: string }) {
  const [rows, setRows] = useState<MemoRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ visit_date: "", summary: "", details: "" });

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/memos?ticker=${encodeURIComponent(ticker)}`, { cache: "no-store" });
      const data = (await res.json()) as MemoRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, [ticker]);

  const handleSave = async () => {
    if (!form.visit_date) return;
    setSaving(true);
    try {
      await fetch("/api/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, ...form }),
      });
      setForm({ visit_date: "", summary: "", details: "" });
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/memos?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setExpanded((prev) => (prev === id ? null : prev));
    await load();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: "13px" }}>탐방 메모</p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", color: "#374151" }}
        >
          {showForm ? "취소" : "+ 추가"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "#f9fafb", borderRadius: "8px", padding: "10px", marginBottom: "8px", display: "grid", gap: "6px" }}>
          <div>
            <label style={{ fontSize: "11px", color: "#6b7280" }}>날짜</label>
            <input
              type="date"
              value={form.visit_date}
              onChange={(e) => setForm((f) => ({ ...f, visit_date: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: "11px", color: "#6b7280" }}>주요내용</label>
            <input
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              placeholder="핵심 포인트를 한 줄로 요약"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: "11px", color: "#6b7280" }}>상세내용</label>
            <textarea
              value={form.details}
              onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
              placeholder="미팅에서 나온 내용, 체크포인트 등 상세 기록"
              rows={4}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !form.visit_date}
            style={{ padding: "5px 12px", borderRadius: "6px", border: "none", background: "#2563eb", color: "#fff", fontSize: "12px", cursor: "pointer", fontWeight: 600, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      )}

      {isLoading ? (
        <p style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>불러오는 중...</p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>메모 없음</p>
      ) : (
        <div style={{ display: "grid", gap: "6px" }}>
          {rows.map((r) => (
            <div key={r.id} style={{ border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
              <div
                onClick={() => setExpanded((prev) => (prev === r.id ? null : r.id))}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", cursor: "pointer", background: expanded === r.id ? "#eff6ff" : "#fff" }}
              >
                <div style={{ display: "flex", gap: "10px", alignItems: "baseline", minWidth: 0 }}>
                  <span style={{ fontSize: "11px", color: "#6b7280", whiteSpace: "nowrap" }}>{r.visit_date}</span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.summary || "(주요내용 없음)"}
                  </span>
                </div>
                <span style={{ fontSize: "11px", color: "#9ca3af", marginLeft: "8px" }}>{expanded === r.id ? "▲" : "▼"}</span>
              </div>
              {expanded === r.id && (
                <div style={{ padding: "8px 10px", borderTop: "1px solid #e5e7eb", background: "#fafafa" }}>
                  {r.details ? (
                    <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{r.details}</p>
                  ) : (
                    <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#9ca3af" }}>(상세내용 없음)</p>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDelete(r.id)}
                    style={{ fontSize: "11px", color: "#ef4444", border: "none", background: "none", cursor: "pointer", padding: 0 }}
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CompanyPanel({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [tab, setTab] = useState<"annual" | "quarterly">("annual");
  const [period, setPeriod] = useState<ChartPeriod>("1d");

  // 티커 변경 시 전체 데이터 재조회
  useEffect(() => {
    setIsLoading(true);
    setDetail(null);
    setPeriod("1d");
    fetch(`/api/company-detail?ticker=${encodeURIComponent(ticker)}&period=1d`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setDetail(d as CompanyDetail))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [ticker]);

  // period 변경 시 차트 데이터만 재조회
  useEffect(() => {
    if (!detail) return;
    setIsChartLoading(true);
    fetch(`/api/company-detail?ticker=${encodeURIComponent(ticker)}&period=${period}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setDetail((prev) => prev ? { ...prev, priceHistory: (d as CompanyDetail).priceHistory } : prev))
      .catch(console.error)
      .finally(() => setIsChartLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", display: "grid", gap: "14px", maxHeight: "80vh", overflowY: "auto" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          {isLoading ? (
            <p style={{ margin: 0, color: "#6b7280" }}>불러오는 중...</p>
          ) : detail ? (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>{detail.companyName}</h2>
                {detail.marketCap !== null && (
                  <span style={{ fontSize: "13px", color: "#6b7280", fontWeight: 500 }}>
                    시총 {formatKRW(detail.marketCap)}
                  </span>
                )}
              </div>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "13px" }}>주가 차트</p>
              <div style={{ display: "flex", gap: "4px" }}>
                {(["1d", "1wk", "1mo"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    style={{
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: period === p ? 700 : 400,
                      border: period === p ? "2px solid #2563eb" : "1px solid #d1d5db",
                      background: period === p ? "#eff6ff" : "#fff",
                      color: period === p ? "#2563eb" : "#6b7280",
                      cursor: "pointer",
                    }}
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
            {isChartLoading ? (
              <p style={{ color: "#9ca3af", fontSize: "13px", margin: 0 }}>차트 불러오는 중...</p>
            ) : (
              <PriceChart data={detail.priceHistory} period={period} />
            )}
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
          <EstimatesSection ticker={ticker} />

          {/* 탐방 메모 */}
          <MemosSection ticker={ticker} />
        </>
      )}
    </div>
  );
}
