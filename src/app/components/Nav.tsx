"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/calendar", label: "캘린더" },
  { href: "/followup", label: "팔로업" },
  { href: "/universe", label: "유니버스" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "52px",
        background: "#fff",
        borderBottom: "1px solid #e5e7eb",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: "8px",
        zIndex: 100,
      }}
    >
      {links.map((link) => {
        const isActive = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              fontWeight: isActive ? 700 : 400,
              background: isActive ? "#eff6ff" : "transparent",
              color: isActive ? "#2563eb" : "#374151",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
