import type { Metadata } from "next";
import { SitePage } from "@/components/site-page";

export const metadata: Metadata = {
  title: "About",
  description: "About PDF Editor and its browser-first approach to quick PDF edits.",
};

export default function AboutPage() {
  return (
    <SitePage kicker="About" title="A simple PDF editor for quick document cleanup">
      <p>
        PDF Editor is built for small, practical edits: upload a PDF, match a page color, cover a section, add replacement
        text, preview the result, and export a new file. The current version is focused on being fast and easy to use
        without requiring an account.
      </p>
      <p>
        The editor runs locally in your browser. In this MVP, your PDF is rendered and edited on your device rather than
        uploaded to an application server. That keeps the workflow simple and makes the tool a good fit for resumes,
        forms, invoices, study notes, and other everyday documents you own or have permission to edit.
      </p>
      <p>
        Visual cover boxes are useful for clean presentation, but they should not be treated as secure redaction. If a PDF
        contains sensitive hidden text or metadata, use a dedicated redaction workflow before sharing it publicly.
      </p>
    </SitePage>
  );
}
