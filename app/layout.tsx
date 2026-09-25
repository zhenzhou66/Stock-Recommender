import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { usingLocalData } from "@/lib/data";

export const metadata: Metadata = { title: "KLSE Swing Desk", description: "Bursa Malaysia swing-trading reports: market check, catalysts, early candidates." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans+Condensed:wght@600;700&family=IBM+Plex+Sans:wght@400;600&display=swap" />
      </head>
      <body>
        <div className="wrap">
          <header className="nav">
            <div><div className="label">Bursa Malaysia · swing trading, days to weeks</div><h1><Link href="/" style={{ color: "inherit" }}>KLSE Swing Desk</Link></h1></div>
            <nav><Link href="/">Latest report</Link><Link href="/runs">History</Link></nav>
          </header>
          {usingLocalData() && <div className="banner">Showing data from the repo&apos;s data/ folder. Set the Supabase environment variables to read from the database.</div>}
          {children}
          <p className="note">Reports are produced by Claude from TradingView data, Bursa announcements and established news and broker sources. Prices are end-of-day. Research to support your own decisions, not financial advice.</p>
        </div>
      </body>
    </html>
  );
}
