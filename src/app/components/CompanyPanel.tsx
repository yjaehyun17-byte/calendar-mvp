"use client";

import { useEffect, useRef, useState } from "react";
import MemoModal from "./MemoModal";

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
  if (data.length < 2) return <p style={{ color: "var(--color-text-faint)", fontSize: "13px" }}>차트 데이터 없음</p>;

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
  if (rows.length === 0) return <p style={{ fontSize: "12px", color: "var(--color-text-faint)", margin: 0 }}>데이터 없음</p>;
  return (
    <div>
      <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "13px" }}>{title}</p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ background: "var(--color-bg-subtle)", borderBottom: "1px solid var(--color-border)" }}>
              <th style={thStyle}>기간</th>
              <th style={thStyle}>매출</th>
              <th style={thStyle}>영업이익</th>
              <th style={thStyle}>순이익</th>
              <th style={thStyle}>EPS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.period} style={{ borderBottom: "1px solid var(--color-bg-row)" }}>
                <td style={tdStyle}>{r.period}</td>
                <td style={tdStyle}>{formatKRW(r.revenue)}</td>
                <td style={{ ...tdStyle, color: r.operatingIncome !== null ? (r.operatingIncome >= 0 ? "#dc2626" : "#2563eb") : "var(--color-text-muted)" }}>{formatKRW(r.operatingIncome)}</td>
                <td style={{ ...tdStyle, color: r.netIncome !== null ? (r.netIncome >= 0 ? "#dc2626" : "#2563eb") : "var(--color-text-muted)" }}>{formatKRW(r.netIncome)}</td>
                <td style={tdStyle}>{formatEPS(r.eps)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: "6px 8px", textAlign: "left", fontWeight: 600, color: "var(--color-text-secondary)", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "6px 8px", color: "var(--color-text-secondary)", whiteSpace: "nowrap" };

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
          style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", border: "1px solid var(--color-border-light)", background: "var(--color-bg-card)", cursor: "pointer", color: "var(--color-text-secondary)" }}
        >
          {showForm ? "취소" : "+ 추가"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "var(--color-bg-subtle)", borderRadius: "8px", padding: "10px", marginBottom: "8px", display: "grid", gap: "6px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <div>
              <label style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>기간 (예: 2025, 2025-Q1)</label>
              <input
                value={form.period}
                onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
                placeholder="2025"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>EPS (원)</label>
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
              <label style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>매출 (억)</label>
              <input
                value={form.revenue}
                onChange={(e) => setForm((f) => ({ ...f, revenue: e.target.value }))}
                placeholder="100000000"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>영업이익 (억)</label>
              <input
                value={form.operating_income}
                onChange={(e) => setForm((f) => ({ ...f, operating_income: e.target.value }))}
                placeholder="10000000"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>순이익 (억)</label>
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
        <p style={{ fontSize: "12px", color: "var(--color-text-faint)", margin: 0 }}>불러오는 중...</p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: "12px", color: "var(--color-text-faint)", margin: 0 }}>추정치 없음</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ background: "var(--color-bg-subtle)", borderBottom: "1px solid var(--color-border)" }}>
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
                <tr key={r.id} style={{ borderBottom: "1px solid var(--color-bg-row)" }}>
                  <td style={tdStyle}>{r.period}</td>
                  <td style={tdStyle}>{formatKRW(r.revenue)}</td>
                  <td style={{ ...tdStyle, color: r.operating_income !== null ? (r.operating_income >= 0 ? "#dc2626" : "#2563eb") : "var(--color-text-muted)" }}>{formatKRW(r.operating_income)}</td>
                  <td style={{ ...tdStyle, color: r.net_income !== null ? (r.net_income >= 0 ? "#dc2626" : "#2563eb") : "var(--color-text-muted)" }}>{formatKRW(r.net_income)}</td>
                  <td style={tdStyle}>{formatEPS(r.eps)}</td>
                  <td style={{ padding: "6px 4px" }}>
                    <button
                      type="button"
                      onClick={() => void handleDelete(r.id)}
                      style={{ fontSize: "10px", color: "var(--color-text-faint)", border: "none", background: "none", cursor: "pointer", padding: 0 }}
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
  border: "1px solid var(--color-border-light)",
  borderRadius: "4px",
  boxSizing: "border-box",
  background: "var(--color-bg-card)",
  color: "var(--color-text-primary)",
};

type TimelineEntry = { date: string; content: string };
type MemoRow = { id: string; ticker: string; visit_date: string; summary: string; timeline: TimelineEntry[]; details: string };

const emptyForm = () => ({ visit_date: "", summary: "", timeline: [] as TimelineEntry[], details: "" });

function MemosSection({ ticker, forceOpen, onFormClose }: { ticker: string; forceOpen?: boolean; onFormClose?: () => void }) {
  const [rows, setRows] = useState<MemoRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (forceOpen) setShowForm(true);
  }, [forceOpen]);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState<ReturnType<typeof emptyForm>>(emptyForm());
  // 타임라인 입력 임시 상태
  const [tlInput, setTlInput] = useState({ date: "", content: "" });

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

  const addTimelineEntry = () => {
    if (!tlInput.date && !tlInput.content) return;
    setForm((f) => ({ ...f, timeline: [...f.timeline, { date: tlInput.date, content: tlInput.content }] }));
    setTlInput({ date: "", content: "" });
  };

  const removeTimelineEntry = (idx: number) => {
    setForm((f) => ({ ...f, timeline: f.timeline.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    if (!form.visit_date) return;
    setSaving(true);
    try {
      await fetch("/api/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, ...form }),
      });
      setForm(emptyForm());
      setTlInput({ date: "", content: "" });
      setShowForm(false);
      onFormClose?.();
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
        <p style={{ margin: 0, fontWeight: 700, fontSize: "13px" }}>기업 팔로업</p>
        <button
          type="button"
          onClick={() => { const next = !showForm; setShowForm(next); if (!next) { setForm(emptyForm()); setTlInput({ date: "", content: "" }); onFormClose?.(); } }}
          style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", border: "1px solid var(--color-border-light)", background: "var(--color-bg-card)", cursor: "pointer", color: "var(--color-text-secondary)" }}
        >
          {showForm ? "취소" : "+ 추가"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "var(--color-bg-subtle)", borderRadius: "8px", padding: "10px", marginBottom: "8px", display: "grid", gap: "8px" }}>
          {/* 날짜 */}
          <div>
            <label style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>날짜</label>
            <input
              type="date"
              value={form.visit_date}
              onChange={(e) => setForm((f) => ({ ...f, visit_date: e.target.value }))}
              style={inputStyle}
            />
          </div>

          {/* 주요내용 */}
          <div>
            <label style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>주요내용</label>
            <input
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              placeholder="핵심 포인트를 한 줄로 요약"
              style={inputStyle}
            />
          </div>

          {/* 주요 타임라인 */}
          <div>
            <label style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>주요 타임라인</label>
            {form.timeline.length > 0 && (
              <div style={{ display: "grid", gap: "4px", marginBottom: "6px", marginTop: "4px" }}>
                {form.timeline.map((entry, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: "6px", padding: "4px 8px" }}>
                    <span style={{ fontSize: "11px", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>{entry.date}</span>
                    <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", flex: 1 }}>{entry.content}</span>
                    <button
                      type="button"
                      onClick={() => removeTimelineEntry(idx)}
                      style={{ fontSize: "11px", color: "var(--color-text-faint)", border: "none", background: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "4px", alignItems: "center" }}>
              <input
                type="date"
                value={tlInput.date}
                onChange={(e) => setTlInput((t) => ({ ...t, date: e.target.value }))}
                style={{ ...inputStyle, width: "auto" }}
              />
              <input
                value={tlInput.content}
                onChange={(e) => setTlInput((t) => ({ ...t, content: e.target.value }))}
                placeholder="내용 입력"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTimelineEntry(); } }}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={addTimelineEntry}
                style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #2563eb", background: "#eff6ff", color: "#2563eb", fontSize: "11px", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                추가
              </button>
            </div>
          </div>

          {/* 상세내용 */}
          <div>
            <label style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>상세내용</label>
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
        <p style={{ fontSize: "12px", color: "var(--color-text-faint)", margin: 0 }}>불러오는 중...</p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: "12px", color: "var(--color-text-faint)", margin: 0 }}>팔로업 내용 없음</p>
      ) : (
        <div style={{ display: "grid", gap: "6px" }}>
          {rows.map((r) => (
            <div key={r.id} style={{ border: "1px solid var(--color-border)", borderRadius: "8px", overflow: "hidden" }}>
              <div
                onClick={() => setExpanded((prev) => (prev === r.id ? null : r.id))}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", cursor: "pointer", background: expanded === r.id ? "var(--color-memo-expanded)" : "var(--color-bg-card)" }}
              >
                <div style={{ display: "flex", gap: "10px", alignItems: "baseline", minWidth: 0 }}>
                  <span style={{ fontSize: "11px", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>{r.visit_date}</span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.summary || "(주요내용 없음)"}
                  </span>
                </div>
                <span style={{ fontSize: "11px", color: "var(--color-text-faint)", marginLeft: "8px" }}>{expanded === r.id ? "▲" : "▼"}</span>
              </div>
              {expanded === r.id && (
                <div style={{ padding: "10px", borderTop: "1px solid var(--color-border)", background: "var(--color-memo-detail-bg)", display: "grid", gap: "8px" }}>
                  {/* 타임라인 */}
                  {r.timeline?.length > 0 && (
                    <div>
                      <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)" }}>주요 타임라인</p>
                      <div style={{ display: "grid", gap: "3px", borderLeft: "2px solid #2563eb", paddingLeft: "8px" }}>
                        {r.timeline.map((entry, idx) => (
                          <div key={idx} style={{ display: "flex", gap: "8px", fontSize: "12px" }}>
                            <span style={{ color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>{entry.date}</span>
                            <span style={{ color: "var(--color-text-secondary)" }}>{entry.content}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* 상세내용 */}
                  {r.details && (
                    <div>
                      <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)" }}>상세내용</p>
                      <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{r.details}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDelete(r.id)}
                    style={{ fontSize: "11px", color: "#ef4444", border: "none", background: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
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

type ChecklistItem = { id: string; ticker: string; content: string; checked: boolean };

function ChecklistSection({ ticker, companyName }: { ticker: string; companyName: string }) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [memoTarget, setMemoTarget] = useState<{ ticker: string; companyName: string } | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/checklists?ticker=${encodeURIComponent(ticker)}`, { cache: "no-store" });
      const data = (await res.json()) as ChecklistItem[];
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, [ticker]);

  const handleAdd = async () => {
    if (!input.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, content: input.trim() }),
      });
      const item = (await res.json()) as ChecklistItem;
      setItems((prev) => [...prev, item]);
      setInput("");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item: ChecklistItem) => {
    const res = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, checked: !item.checked }),
    });
    const updated = (await res.json()) as ChecklistItem;
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    if (updated.checked) {
      setMemoTarget({ ticker, companyName });
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/checklists?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const done = items.filter((i) => i.checked).length;

  return (
    <>
    {memoTarget && (
      <MemoModal
        ticker={memoTarget.ticker}
        companyName={memoTarget.companyName}
        onClose={() => setMemoTarget(null)}
      />
    )}
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: "13px" }}>체크리스트</p>
        {items.length > 0 && (
          <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>{done}/{items.length}</span>
        )}
      </div>

      {/* 입력 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px", marginBottom: "8px" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAdd(); } }}
          placeholder="체크리스트 항목 입력"
          style={inputStyle}
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={saving || !input.trim()}
          style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid #2563eb", background: "#eff6ff", color: "#2563eb", fontSize: "12px", cursor: "pointer", fontWeight: 600, opacity: saving ? 0.6 : 1 }}
        >
          추가
        </button>
      </div>

      {isLoading ? (
        <p style={{ fontSize: "12px", color: "var(--color-text-faint)", margin: 0 }}>불러오는 중...</p>
      ) : items.length === 0 ? (
        <p style={{ fontSize: "12px", color: "var(--color-text-faint)", margin: 0 }}>항목 없음</p>
      ) : (
        <div style={{ display: "grid", gap: "4px" }}>
          {items.map((item) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => void handleToggle(item)}
                style={{ accentColor: "#2563eb", flexShrink: 0 }}
              />
              <span style={{
                flex: 1,
                fontSize: "12px",
                color: item.checked ? "var(--color-text-faint)" : "var(--color-text-primary)",
                textDecoration: item.checked ? "line-through" : "none",
              }}>
                {item.content}
              </span>
              <button
                type="button"
                onClick={() => void handleDelete(item.id)}
                style={{ fontSize: "11px", color: "var(--color-border-light)", border: "none", background: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
}

export default function CompanyPanel({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [tab, setTab] = useState<"annual" | "quarterly">("annual");
  const [period, setPeriod] = useState<ChartPeriod>("1d");
  const [memoFormOpen, setMemoFormOpen] = useState(false);
  const [inUniverse, setInUniverse] = useState(false);
  const [universeLoading, setUniverseLoading] = useState(false);
  const memosSectionRef = useRef<HTMLDivElement>(null);

  // 티커 변경 시 전체 데이터 재조회 + 유니버스 여부 확인
  useEffect(() => {
    setIsLoading(true);
    setDetail(null);
    setPeriod("1d");
    setMemoFormOpen(false);

    Promise.all([
      fetch(`/api/company-detail?ticker=${encodeURIComponent(ticker)}&period=1d`, { cache: "no-store" })
        .then((r) => r.json()),
      fetch("/api/universe", { cache: "no-store" })
        .then((r) => r.json()),
    ])
      .then(([detail, universe]) => {
        setDetail(detail as CompanyDetail);
        const tickers = (universe as { ticker: string }[]).map((u) => u.ticker);
        setInUniverse(tickers.includes(ticker));
      })
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
    <div style={{ border: "1px solid var(--color-border)", borderRadius: "12px", padding: "16px", display: "grid", gap: "14px", maxHeight: "80vh", overflowY: "auto", background: "var(--color-bg-card)" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          {isLoading ? (
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>불러오는 중...</p>
          ) : detail ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>{detail.companyName}</h2>
                {detail.marketCap !== null && (
                  <span style={{ fontSize: "13px", color: "var(--color-text-muted)", fontWeight: 500 }}>
                    시총 {formatKRW(detail.marketCap)}
                  </span>
                )}
                <button
                  type="button"
                  disabled={universeLoading}
                  onClick={async () => {
                    setUniverseLoading(true);
                    try {
                      if (inUniverse) {
                        await fetch(`/api/universe?ticker=${encodeURIComponent(ticker)}`, { method: "DELETE" });
                        setInUniverse(false);
                      } else {
                        await fetch("/api/universe", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ ticker }),
                        });
                        setInUniverse(true);
                        setMemoFormOpen(true);
                        setTimeout(() => memosSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                      }
                    } finally {
                      setUniverseLoading(false);
                    }
                  }}
                  style={{
                    fontSize: "11px",
                    padding: "3px 10px",
                    borderRadius: "6px",
                    border: inUniverse ? "1px solid #16a34a" : "1px solid #2563eb",
                    background: inUniverse ? "var(--color-green-bg)" : "var(--color-blue-bg)",
                    color: inUniverse ? "#16a34a" : "#2563eb",
                    cursor: universeLoading ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    opacity: universeLoading ? 0.6 : 1,
                  }}
                >
                  {inUniverse ? "팔로업 중 ✓" : "팔로업하기"}
                </button>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--color-text-muted)" }}>{detail.ticker} · {detail.market}</p>
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
        <button type="button" onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "18px", color: "var(--color-text-muted)", lineHeight: 1 }}>✕</button>
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
                      border: period === p ? "2px solid #2563eb" : "1px solid var(--color-border-light)",
                      background: period === p ? "var(--color-blue-bg)" : "var(--color-bg-card)",
                      color: period === p ? "#2563eb" : "var(--color-text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
            {isChartLoading ? (
              <p style={{ color: "var(--color-text-faint)", fontSize: "13px", margin: 0 }}>차트 불러오는 중...</p>
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
                    border: tab === t ? "2px solid #2563eb" : "1px solid var(--color-border-light)",
                    background: tab === t ? "var(--color-blue-bg)" : "var(--color-bg-card)",
                    color: tab === t ? "#2563eb" : "var(--color-text-secondary)",
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

          {/* 기업 팔로업 */}
          <div ref={memosSectionRef}>
            <MemosSection ticker={ticker} forceOpen={memoFormOpen} onFormClose={() => setMemoFormOpen(false)} />
          </div>

          {/* 체크리스트 */}
          <ChecklistSection ticker={ticker} companyName={detail.companyName} />
        </>
      )}
    </div>
  );
}
