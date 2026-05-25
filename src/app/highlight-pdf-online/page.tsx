import type { Metadata } from "next";
import { SeoToolPage } from "@/components/seo-tool-page";

export const metadata: Metadata = {
  title: "Highlight PDF Online",
  description: "Highlight a PDF online with translucent marker overlays, then export a new highlighted PDF.",
  alternates: {
    canonical: "/highlight-pdf-online",
  },
};

export default function HighlightPdfOnlinePage() {
  return (
    <SeoToolPage
      kicker="PDF highlight"
      title="Highlight a PDF online"
      intro="Patch PDF includes a highlight tool for marking text, sections, or visual areas in a PDF. Highlights are placed as translucent overlays and exported into a new PDF."
      steps={[
        "Upload your PDF.",
        "Choose the Highlight tool.",
        "Drag over the text or area you want to mark.",
        "Move, resize, or recolor the highlight if needed.",
        "Export the highlighted PDF.",
      ]}
    >
      <h2 className="text-2xl font-semibold text-[#211f1c]">When highlighting helps</h2>
      <p>
        Highlighting is useful for notes, study material, review documents, screenshots saved as PDFs, and simple markup
        before sharing a file.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Visual highlights</h2>
      <p>
        Highlights are visual overlays. They are designed for presentation and review, not for changing the underlying
        text structure of the original PDF.
      </p>
    </SeoToolPage>
  );
}
