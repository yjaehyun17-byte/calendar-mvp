"use client";

import { useEffect, useState, useCallback } from "react";
import type { NewsItem } from "../api/news/route";

type Tab = "domestic" | "global" | "disclosure";

const TABS: { key: Tab; label: string }[] = [
  { key: "domestic", label: "국내 뉴스" },
  { key: "global", label: "해외 뉴스" },
  { key: "disclosure", label: "공시 정리" },
];

function formatPubDate(raw: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
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
        padding: "14px 16px",
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-border)",
        borderRadius: "10px",
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
          gap: "12px",
          marginBottom: item.description ? "6px" : "0",
        }}
      >
        <span
          style={{
            fontSize: "14px",
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
            gap: "4px",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: "11px",
              color: "white",
              background: "#2563eb",
              padding: "2px 7px",
              borderRadius: "4px",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {item.source}
          </span>
          <span
            style={{
              fontSize: "11px",
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
            fontSize: "12px",
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: "72px",
              background: "var(--color-bg-row)",
              borderRadius: "10px",
              border: "1px solid var(--color-border)",
              animation: "pulse 1.5s ease-in-out infinite",
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
          gap: "12px",
          height: "200px",
          color: "var(--color-text-muted)",
          fontSize: "14px",
        }}
      >
        <span>뉴스를 불러오지 못했습니다.</span>
        <button
          onClick={() => void load()}
          style={{
            padding: "6px 16px",
            fontSize: "13px",
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

  if (items.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "200px",
          color: "var(--color-text-faint)",
          fontSize: "14px",
          border: "1px dashed var(--color-border)",
          borderRadius: "10px",
        }}
      >
        뉴스가 없습니다.
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
          marginBottom: "12px",
        }}
      >
        <span style={{ fontSize: "12px", color: "var(--color-text-faint)" }}>
          {items.length}개 기사
        </span>
        <button
          onClick={() => void load()}
          style={{
            fontSize: "12px",
            color: "#2563eb",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "2px 6px",
          }}
        >
          새로고침
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {items.map((item, i) => (
          <NewsCard key={`${item.link}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function DisclosureSummary() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "240px",
        color: "var(--color-text-faint)",
        fontSize: "14px",
        border: "1px dashed var(--color-border)",
        borderRadius: "10px",
      }}
    >
      공시 정리 기능을 준비 중입니다.
    </div>
  );
}

export default function NewsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("domestic");

  return (
    <div
      style={{
        paddingTop: "72px",
        paddingLeft: "24px",
        paddingRight: "24px",
        maxWidth: "900px",
        margin: "0 auto",
        paddingBottom: "48px",
      }}
    >
      {/* 탭 헤더 */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          marginBottom: "24px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "8px 18px",
                fontSize: "14px",
                fontWeight: isActive ? 700 : 400,
                color: isActive ? "#2563eb" : "var(--color-text-muted)",
                background: "transparent",
                border: "none",
                borderBottom: isActive
                  ? "2px solid #2563eb"
                  : "2px solid transparent",
                cursor: "pointer",
                marginBottom: "-1px",
                transition: "color 0.15s",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "domestic" && <NewsFeed type="domestic" />}
      {activeTab === "global" && <NewsFeed type="global" />}
      {activeTab === "disclosure" && <DisclosureSummary />}
    </div>
  );
}
