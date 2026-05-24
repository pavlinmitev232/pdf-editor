import type { Metadata } from "next";
import { SeoToolPage } from "@/components/seo-tool-page";

export const metadata: Metadata = {
  title: "Cover Text in PDF Online",
  description: "Cover old text or visual mistakes in a PDF using color-matched boxes, then export a cleaned PDF.",
  alternates: {
    canonical: "/cover-text-in-pdf",
  },
};

export default function CoverTextInPdfPage() {
  return (
    <SeoToolPage
      kicker="PDF cover"
      title="Cover text in a PDF"
      intro="Patch PDF lets you draw cover boxes over visible PDF content. Use the color picker first so the box matches the page background as closely as possible."
      steps={[
        "Upload the PDF you are allowed to edit.",
        "Use Pick color on the background near the text.",
        "Choose Box and drag over the content you want to cover.",
        "Resize or move the box if needed.",
        "Preview and export the cleaned PDF.",
      ]}
    >
      <h2 className="text-2xl font-semibold text-[#211f1c]">Visual cover vs secure redaction</h2>
      <p>
        A cover box changes how the PDF looks, but it should not be treated as secure redaction. Hidden text, metadata,
        comments, attachments, or layers may still exist in some PDFs. Use dedicated redaction software for sensitive
        information.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Best result</h2>
      <p>
        Sample a clean area close to the text you want to hide. Backgrounds can vary across a page, especially in scans or
        designed documents.
      </p>
    </SeoToolPage>
  );
}

