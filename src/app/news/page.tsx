"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { NewsItem } from "../api/news/route";
import type { Disclosure } from "../api/disclosures/route";

function formatPubDate(raw: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        padding: "12px 14px",
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-border)",
        borderRadius: "8px",
        textDecoration: "none",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "#2563eb";
        (e.currentTarget as HTMLAnchorElement).style.boxShadow =
          "0 2px 8px rgba(37,99,235,0.08)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor =
          "var(--color-border)";
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "8px",
          marginBottom: item.description ? "5px" : "0",
        }}
      >
        <span
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--color-text-primary)",
            lineHeight: "1.45",
          }}
        >
          {item.title}
        </span>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "3px",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: "10px",
              color: "white",
              background: "#2563eb",
              padding: "1px 6px",
              borderRadius: "4px",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {item.source}
          </span>
          <span
            style={{
              fontSize: "10px",
              color: "var(--color-text-faint)",
              whiteSpace: "nowrap",
            }}
          >
            {formatPubDate(item.pubDate)}
          </span>
        </div>
      </div>
      {item.description && (
        <p
          style={{
            margin: 0,
            fontSize: "11px",
            color: "var(--color-text-muted)",
            lineHeight: "1.5",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.description}
        </p>
      )}
    </a>
  );
}

function NewsFeed({ type }: { type: "domestic" | "global" }) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/news?type=${type}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as NewsItem[];
      setItems(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: "64px",
              background: "var(--color-bg-row)",
              borderRadius: "8px",
              border: "1px solid var(--color-border)",
              opacity: 1 - i * 0.1,
            }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          height: "160px",
          color: "var(--color-text-muted)",
          fontSize: "13px",
        }}
      >
        <span>불러오지 못했습니다.</span>
        <button
          onClick={() => void load()}
          style={{
            padding: "5px 14px",
            fontSize: "12px",
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
        }}
      >
        <span style={{ fontSize: "11px", color: "var(--color-text-faint)" }}>
          {items.length}개
        </span>
        <button
          onClick={() => void load()}
          style={{
            fontSize: "11px",
            color: "#2563eb",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "2px 4px",
          }}
        >
          새로고침
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
        {items.map((item, i) => (
          <NewsCard key={`${item.link}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function DisclosureSummary() {
  const [items, setItems] = useState<Disclosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/disclosures", { cache: "no-store" });
      const data = (await res.json()) as Disclosure[];
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    if (!date || !url.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/disclosures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, label: label.trim(), url: url.trim() }),
      });
      if (res.ok) {
        setLabel("");
        setUrl("");
        setShowForm(false);
        void load();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/disclosures?id=${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
  };

  return (
    <div>
      {/* 추가 버튼 */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px" }}>
        <button
          onClick={() => {
            setShowForm((v) => !v);
            setTimeout(() => urlRef.current?.focus(), 50);
          }}
          style={{
            fontSize: "12px",
            padding: "4px 12px",
            background: showForm ? "var(--color-bg-row)" : "#2563eb",
            color: showForm ? "var(--color-text-muted)" : "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {showForm ? "취소" : "+ 추가"}
        </button>
      </div>

      {/* 입력 폼 */}
      {showForm && (
        <div
          style={{
            background: "var(--color-bg-subtle)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                flex: "0 0 auto",
                padding: "6px 8px",
                fontSize: "12px",
                border: "1px solid var(--color-border)",
                borderRadius: "6px",
                background: "var(--color-bg-card)",
                color: "var(--color-text-primary)",
              }}
            />
            <input
              type="text"
              placeholder="제목 (선택)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              style={{
                flex: 1,
                padding: "6px 8px",
                fontSize: "12px",
                border: "1px solid var(--color-border)",
                borderRadius: "6px",
                background: "var(--color-bg-card)",
                color: "var(--color-text-primary)",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              ref={urlRef}
              type="url"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
              style={{
                flex: 1,
                padding: "6px 8px",
                fontSize: "12px",
                border: "1px solid var(--color-border)",
                borderRadius: "6px",
                background: "var(--color-bg-card)",
                color: "var(--color-text-primary)",
              }}
            />
            <button
              onClick={() => void handleAdd()}
              disabled={saving || !url.trim()}
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                background: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: saving || !url.trim() ? "not-allowed" : "pointer",
                opacity: saving || !url.trim() ? 0.5 : 1,
                fontWeight: 600,
              }}
            >
              저장
            </button>
          </div>
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: "48px",
                background: "var(--color-bg-row)",
                borderRadius: "8px",
                border: "1px solid var(--color-border)",
                opacity: 1 - i * 0.2,
              }}
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "160px",
            color: "var(--color-text-faint)",
            fontSize: "13px",
            border: "1px dashed var(--color-border)",
            borderRadius: "8px",
          }}
        >
          공시를 추가해보세요.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                background: "var(--color-bg-card)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--color-text-faint)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {formatDate(item.date)}
              </span>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#2563eb",
                  textDecoration: "none",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none";
                }}
              >
                {item.label || item.url}
              </a>
              <button
                onClick={() => void handleDelete(item.id)}
                style={{
                  flexShrink: 0,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-text-faint)",
                  fontSize: "14px",
                  padding: "0 2px",
                  lineHeight: 1,
                }}
                title="삭제"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type Column = {
  title: string;
  content: React.ReactNode;
};

export default function NewsPage() {
  const columns: Column[] = [
    { title: "국내 뉴스", content: <NewsFeed type="domestic" /> },
    { title: "해외 뉴스", content: <NewsFeed type="global" /> },
    { title: "공시 정리", content: <DisclosureSummary /> },
  ];

  return (
    <div
      style={{
        paddingTop: "68px",
        paddingLeft: "20px",
        paddingRight: "20px",
        paddingBottom: "48px",
        height: "100vh",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "16px",
          flex: 1,
          minHeight: 0,
        }}
      >
        {columns.map((col) => (
          <div
            key={col.title}
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            {/* 컬럼 헤더 */}
            <div
              style={{
                padding: "10px 4px",
                marginBottom: "10px",
                borderBottom: "2px solid #2563eb",
              }}
            >
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                }}
              >
                {col.title}
              </span>
            </div>
            {/* 스크롤 영역 */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                paddingRight: "4px",
              }}
            >
              {col.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
