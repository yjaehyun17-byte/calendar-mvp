import type { Metadata } from "next";
import "./globals.css";
import Nav from "./components/Nav";

export const metadata: Metadata = {
  title: "Calendar MVP",
  description: "기업 탐방 일정 관리",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Nav />
        <div style={{ paddingTop: "52px" }}>{children}</div>
      </body>
    </html>
  );
}
