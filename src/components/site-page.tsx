import Link from "next/link";
import type { ReactNode } from "react";
import { seoPages, siteConfig } from "@/lib/site";

type SitePageProps = {
  title: string;
  kicker?: string;
  children: ReactNode;
};

const navLinks = [
  { href: "/", label: "Editor" },
  { href: "/edit-pdf-online", label: "Tools" },
  { href: "/guides", label: "Guides" },
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Cookies" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
];

export function SitePage({ title, kicker, children }: SitePageProps) {
  return (
    <main className="min-h-screen bg-[#f5f3ef] text-[#211f1c]">
      <header className="border-b border-[#ded8cc] bg-[#fffdfa]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <Link className="text-lg font-semibold" href="/">
            {siteConfig.name}
          </Link>
          <nav className="flex flex-wrap items-center gap-1 text-sm text-[#69635b]">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                className="rounded-md px-3 py-2 hover:bg-[#f5f3ef] hover:text-[#211f1c]"
                href={link.href}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-12">
        {kicker ? <p className="mb-3 text-sm font-semibold uppercase tracking-normal text-[#146c63]">{kicker}</p> : null}
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight">{title}</h1>
        <div className="mt-8 max-w-3xl space-y-6 text-base leading-7 text-[#4d4740]">{children}</div>
      </section>

      <footer className="border-t border-[#ded8cc] bg-[#fffdfa]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-sm text-[#69635b]">
          <span>{siteConfig.name}</span>
          <nav className="flex flex-wrap gap-3">
            {seoPages.slice(0, 3).map((page) => (
              <Link key={page.href} href={page.href}>
                {page.title}
              </Link>
            ))}
            <Link href="/privacy">Privacy</Link>
            <Link href="/cookies">Cookies</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/acceptable-use">Acceptable Use</Link>
            <Link href="/disclaimer">Disclaimer</Link>
            <Link href="/contact">Contact</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
