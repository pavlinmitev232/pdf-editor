import type { Metadata } from "next";
import { SeoToolPage } from "@/components/seo-tool-page";

export const metadata: Metadata = {
  title: "Edit PDF Online Free",
  description: "Edit a PDF online in your browser. Add text, cover content, match colors, preview changes, and export a new PDF.",
  alternates: {
    canonical: "/edit-pdf-online",
  },
};

export default function EditPdfOnlinePage() {
  return (
    <SeoToolPage
      kicker="PDF tool"
      title="Edit PDF online in your browser"
      intro="Patch PDF helps with quick visual PDF edits: add replacement text, cover old content, match background colors, and export a new file without creating an account."
      steps={[
        "Upload a PDF from your device.",
        "Choose text, cover box, color picker, or select mode.",
        "Place edits directly on the rendered PDF page.",
        "Preview the page without editor handles.",
        "Export a new PDF with your visible edits applied.",
      ]}
    >
      <h2 className="text-2xl font-semibold text-[#211f1c]">Best for quick visual edits</h2>
      <p>
        This editor is useful for resumes, forms, invoices, notes, and other documents where you need to correct visible
        content. It is not a full Acrobat replacement yet, but it is fast for common cleanup work.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Private by design</h2>
      <p>
        The current version processes the PDF in your browser. That means the document does not need to be uploaded to an
        application server just to add text or cover a small section.
      </p>
    </SeoToolPage>
  );
}

