import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

export type NewsItem = {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
};

const DOMESTIC_FEEDS = [
  { url: "https://news.naver.com/main/rss/index.naver?sectionId=101", name: "네이버 경제" },
  { url: "https://news.naver.com/main/rss/index.naver?sectionId=105", name: "네이버 IT/과학" },
];

const GLOBAL_FEEDS = [
  { url: "https://feeds.reuters.com/reuters/businessNews", name: "Reuters" },
  { url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", name: "CNBC" },
];

async function fetchRSS(url: string, sourceName: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) return [];

    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: true });
    const result = parser.parse(xml) as Record<string, unknown>;

    const channel = (result?.rss as Record<string, unknown>)?.channel as Record<string, unknown>;
    if (!channel) return [];

    const raw = channel.item;
    const items = Array.isArray(raw) ? raw : raw ? [raw] : [];

    return items.slice(0, 20).map((item: Record<string, unknown>) => ({
      title: String(item.title ?? "")
        .replace(/<[^>]+>/g, "")
        .trim(),
      link: String(item.link ?? item.guid ?? ""),
      pubDate: String(item.pubDate ?? item["dc:date"] ?? ""),
      description: String(item.description ?? "")
        .replace(/<[^>]+>/g, "")
        .trim()
        .slice(0, 200),
      source: sourceName,
    }));
  } catch {
    return [];
  }
}

function sortByDate(items: NewsItem[]): NewsItem[] {
  return items.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "domestic";
  const feeds = type === "global" ? GLOBAL_FEEDS : DOMESTIC_FEEDS;

  const results = await Promise.all(feeds.map((f) => fetchRSS(f.url, f.name)));
  const merged = sortByDate(results.flat());

  return NextResponse.json(merged);
}
