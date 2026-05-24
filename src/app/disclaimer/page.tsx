import type { Metadata } from "next";
import { SitePage } from "@/components/site-page";

export const metadata: Metadata = {
  title: "Disclaimer",
  description: "Important disclaimers for PDF Editor.",
};

export default function DisclaimerPage() {
  return (
    <SitePage kicker="Disclaimer" title="Important disclaimer">
      <p>Last updated: May 25, 2026</p>
      <p>
        PDF Editor is a browser-based document editing utility. It is provided for general productivity purposes and does
        not provide legal, financial, tax, medical, compliance, or other professional advice.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Visual edits are not secure redaction</h2>
      <p>
        Cover boxes and text overlays can change how a PDF looks, but they may not remove underlying text, metadata,
        form values, comments, attachments, hidden layers, or prior versions. Use dedicated redaction software for
        sensitive information.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Document accuracy</h2>
      <p>
        You are responsible for checking exported PDFs before sharing or relying on them. Browser rendering, font
        embedding, PDF structure, scaling, and export behavior can vary across documents.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Third-party services</h2>
      <p>
        The site may rely on third-party hosting, browser technologies, and advertising services. Those services have
        their own policies and technical limitations.
      </p>
    </SitePage>
  );
}
