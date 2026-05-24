import Link from "next/link";
import type { Metadata } from "next";
import { SitePage } from "@/components/site-page";
import { seoPages } from "@/lib/site";

export const metadata: Metadata = {
  title: "PDF Guides",
  description: "Practical PDF editing guides for color matching, cover boxes, and browser-first PDF cleanup.",
};

const guides = [
  {
    href: "/guides/how-to-edit-pdf",
    title: "How to edit a PDF in your browser",
    description: "A simple workflow for uploading, previewing, adding text, and exporting a cleaned PDF.",
  },
  {
    href: "/guides/cover-redact-pdf",
    title: "How to cover information in a PDF",
    description: "When a visual cover is enough, when it is not, and how to avoid sharing hidden sensitive text.",
  },
  {
    href: "/guides/pdf-color-picker",
    title: "How PDF color matching works",
    description: "Why exact color sampling matters when you want a cover box to blend into the original page.",
  },
];

export default function GuidesPage() {
  return (
    <SitePage kicker="Guides" title="PDF editing guides">
      <p>
        These guides explain the practical details behind quick PDF cleanup: matching background colors, covering old
        content, adding replacement text, and exporting a new document from the browser.
      </p>
      <div className="grid gap-3">
        {seoPages.map((page) => (
          <Link
            key={page.href}
            className="rounded-md border border-[#ded8cc] bg-[#fffdfa] p-5 hover:border-[#146c63]"
            href={page.href}
          >
            <h2 className="text-xl font-semibold text-[#211f1c]">{page.title}</h2>
            <p className="mt-2 text-[#69635b]">{page.description}</p>
          </Link>
        ))}
      </div>
      <h2 className="text-2xl font-semibold text-[#211f1c]">More guides</h2>
      <div className="grid gap-3">
        {guides.map((guide) => (
          <Link
            key={guide.href}
            className="rounded-md border border-[#ded8cc] bg-[#fffdfa] p-5 hover:border-[#146c63]"
            href={guide.href}
          >
            <h2 className="text-xl font-semibold text-[#211f1c]">{guide.title}</h2>
            <p className="mt-2 text-[#69635b]">{guide.description}</p>
          </Link>
        ))}
      </div>
    </SitePage>
  );
}
