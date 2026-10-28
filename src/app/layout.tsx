import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: { default: "TrustAni", template: "%s · TrustAni" },
  description: "Unotrusta ani? Trust vanhu. Buyer reviews, fair prices and verified sellers in Zimbabwe.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await currentUser();
  const isMod = profile?.role === "moderator" || profile?.role === "admin";
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap"
        />
        <style>{`:root{--f-display:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;--f-body:"Barlow",system-ui,-apple-system,"Segoe UI",sans-serif;--f-mono:"JetBrains Mono",ui-monospace,Menlo,monospace}`}</style>
      </head>
      <body>
        <header className="site-head">
          <div className="wrap">
            <Link href="/" className="brand" aria-label="TrustAni home">
              <b>Trust<span>Ani</span></b>
              <small>Unotrusta ani? Trust vanhu.</small>
            </Link>
            <nav className="main" aria-label="Main">
              <Link href="/">Sellers</Link>
              <Link href="/prices">Fair prices</Link>
              <Link href="/add">Add a seller</Link>
              {isMod && <Link href="/admin">Moderation</Link>}
              {user ? <Link href="/account">Account</Link> : <Link href="/login">Sign in</Link>}
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="site">
          <div className="wrap">
            TrustAni publishes buyers&apos; own experiences. Reviews are weighted by evidence; sellers can dispute any review.
            Prices are in USD.
          </div>
        </footer>
      </body>
    </html>
  );
}
