"use client";

import { useState } from "react";

type TimelineEntry = { date: string; content: string };
type FormState = { visit_date: string; summary: string; timeline: TimelineEntry[]; details: string };

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  fontSize: "13px",
  border: "1px solid var(--color-border-light)",
  borderRadius: "6px",
  boxSizing: "border-box",
  background: "var(--color-bg-card)",
  color: "var(--color-text-primary)",
};

export default function MemoModal({
  ticker,
  companyName,
  defaultDate,
  onClose,
  onSaved,
}: {
  ticker: string;
  companyName: string;
  defaultDate?: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<FormState>({
    visit_date: defaultDate ?? today,
    summary: "",
    timeline: [],
    details: "",
  });
  const [tlInput, setTlInput] = useState({ date: "", content: "" });
  const [saving, setSaving] = useState(false);

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
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--color-bg-card)",
        borderRadius: "12px",
        padding: "20px",
        width: "100%",
        maxWidth: "480px",
        maxHeight: "90vh",
        overflowY: "auto",
        display: "grid",
        gap: "12px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        {/* 헤더 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>팔로업 메모 추가</h3>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--color-text-muted)" }}>{companyName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: "none", background: "none", cursor: "pointer", fontSize: "18px", color: "var(--color-text-muted)", lineHeight: 1, padding: 0 }}
          >✕</button>
        </div>

        {/* 날짜 */}
        <div>
          <label style={{ fontSize: "12px", color: "var(--color-text-muted)", display: "block", marginBottom: "4px" }}>날짜</label>
          <input
            type="date"
            value={form.visit_date}
            onChange={(e) => setForm((f) => ({ ...f, visit_date: e.target.value }))}
            style={inputStyle}
          />
        </div>

        {/* 주요내용 */}
        <div>
          <label style={{ fontSize: "12px", color: "var(--color-text-muted)", display: "block", marginBottom: "4px" }}>주요내용</label>
          <input
            value={form.summary}
            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            placeholder="핵심 포인트를 한 줄로 요약"
            style={inputStyle}
          />
        </div>

        {/* 주요 타임라인 */}
        <div>
          <label style={{ fontSize: "12px", color: "var(--color-text-muted)", display: "block", marginBottom: "4px" }}>주요 타임라인</label>
          {form.timeline.length > 0 && (
            <div style={{ display: "grid", gap: "4px", marginBottom: "6px" }}>
              {form.timeline.map((entry, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--color-bg-subtle)", border: "1px solid var(--color-border)", borderRadius: "6px", padding: "4px 8px" }}>
                  <span style={{ fontSize: "12px", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>{entry.date}</span>
                  <span style={{ fontSize: "13px", color: "var(--color-text-secondary)", flex: 1 }}>{entry.content}</span>
                  <button type="button" onClick={() => removeTimelineEntry(idx)} style={{ fontSize: "12px", color: "var(--color-text-faint)", border: "none", background: "none", cursor: "pointer", padding: 0 }}>✕</button>
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
              style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #2563eb", background: "var(--color-blue-bg)", color: "#2563eb", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              추가
            </button>
          </div>
        </div>

        {/* 상세내용 */}
        <div>
          <label style={{ fontSize: "12px", color: "var(--color-text-muted)", display: "block", marginBottom: "4px" }}>상세내용</label>
          <textarea
            value={form.details}
            onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
            placeholder="미팅에서 나온 내용, 체크포인트 등 상세 기록"
            rows={5}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        {/* 버튼 */}
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "7px 16px", borderRadius: "8px", border: "1px solid var(--color-border-light)", background: "var(--color-bg-card)", color: "var(--color-text-secondary)", fontSize: "13px", cursor: "pointer" }}
          >
            나중에
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !form.visit_date}
            style={{ padding: "7px 16px", borderRadius: "8px", border: "none", background: "#2563eb", color: "#fff", fontSize: "13px", cursor: "pointer", fontWeight: 600, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
