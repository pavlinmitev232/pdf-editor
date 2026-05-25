import type { Metadata } from "next";
import { SeoToolPage } from "@/components/seo-tool-page";

export const metadata: Metadata = {
  title: "Draw on PDF Online",
  description: "Draw on a PDF online with lines, arrows, highlights, signatures, and visual overlays.",
  alternates: {
    canonical: "/draw-on-pdf",
  },
};

export default function DrawOnPdfPage() {
  return (
    <SeoToolPage
      kicker="PDF drawing"
      title="Draw on a PDF in your browser"
      intro="Use Patch PDF to add visual annotations to a PDF without installing a desktop editor. Draw straight lines, arrows, highlights, signatures, and cover boxes."
      steps={[
        "Upload a PDF.",
        "Choose Line, Arrow, Highlight, Text, or Signature.",
        "Place the drawing or annotation directly on the page.",
        "Move, resize, or recolor the overlay.",
        "Export a new PDF with the annotations applied.",
      ]}
    >
      <h2 className="text-2xl font-semibold text-[#211f1c]">Useful annotation tools</h2>
      <p>
        Lines and arrows are useful for pointing to details, highlights help mark important areas, and signatures make it
        easier to complete simple documents.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Browser-first workflow</h2>
      <p>
        The current editor works locally in your browser for these visual edits, so the PDF does not need to be uploaded
        to an application server for annotation.
      </p>
    </SeoToolPage>
  );
}

