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
  { url: "https://www.yna.co.kr/rss/economy.xml", name: "연합뉴스" },
  { url: "https://www.mk.co.kr/rss/30000001/", name: "매일경제" },
  { url: "https://www.hankyung.com/feed/economy", name: "한국경제" },
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
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: true,
      cdataPropName: "__cdata",
    });
    const result = parser.parse(xml) as Record<string, unknown>;

    const channel = (result?.rss as Record<string, unknown>)?.channel as Record<string, unknown>;
    if (!channel) return [];

    const raw = channel.item;
    const items = Array.isArray(raw) ? raw : raw ? [raw] : [];

    function extractText(val: unknown): string {
      if (val === null || val === undefined) return "";
      if (typeof val === "string") return val;
      if (typeof val === "number") return String(val);
      if (typeof val === "object") {
        const obj = val as Record<string, unknown>;
        if (obj.__cdata) return String(obj.__cdata);
        if (obj["#text"]) return String(obj["#text"]);
      }
      return String(val);
    }

    return items.slice(0, 20).map((item: Record<string, unknown>) => ({
      title: extractText(item.title).replace(/<[^>]+>/g, "").trim(),
      link: extractText(item.link || item.guid),
      pubDate: extractText(item.pubDate ?? item["dc:date"]),
      description: extractText(item.description).replace(/<[^>]+>/g, "").trim().slice(0, 200),
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

async function translateText(text: string): Promise<string> {
  if (!text) return text;
  try {
    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ko&dt=t&q=` +
      encodeURIComponent(text);
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return text;
    const data = (await res.json()) as unknown[][];
    const translated = (data[0] as unknown[][])
      ?.map((part) => String(part[0] ?? ""))
      .join("");
    return translated || text;
  } catch {
    return text;
  }
}

async function translateItems(items: NewsItem[]): Promise<NewsItem[]> {
  // 동시에 너무 많은 요청을 보내지 않도록 5개씩 병렬 처리
  const CHUNK = 5;
  const result: NewsItem[] = [];
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    const translated = await Promise.all(
      chunk.map(async (item) => ({
        ...item,
        title: await translateText(item.title),
        description: item.description ? await translateText(item.description) : "",
      }))
    );
    result.push(...translated);
  }
  return result;
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "domestic";
  const feeds = type === "global" ? GLOBAL_FEEDS : DOMESTIC_FEEDS;

  const results = await Promise.all(feeds.map((f) => fetchRSS(f.url, f.name)));
  const merged = sortByDate(results.flat());

  if (type === "global") {
    const translated = await translateItems(merged);
    return NextResponse.json(translated);
  }

  return NextResponse.json(merged);
}
