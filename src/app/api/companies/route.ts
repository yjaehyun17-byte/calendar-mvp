import { NextResponse } from "next/server";

type GoogleFinanceMatchItem = {
  e?: string;
  n?: string;
  t?: string;
};

type GoogleFinanceMatchResponse = {
  matches?: GoogleFinanceMatchItem[];
};

function buildGoogleFinanceUrl(ticker: string) {
  return `https://www.google.com/finance/quote/${ticker}:KRX`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json([]);
  }

  try {
    const response = await fetch(
      `https://www.google.com/finance/match?matchtype=matchall&q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return NextResponse.json([], { status: 200 });
    }

    const payload = (await response.json()) as GoogleFinanceMatchResponse;
    const results = (payload.matches ?? [])
      .filter((item) => item.e === "KRX" && item.n && item.t)
      .map((item) => ({
        name: item.n as string,
        ticker: item.t as string,
        market: "KRX",
        googleFinanceUrl: buildGoogleFinanceUrl(item.t as string),
      }));

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
