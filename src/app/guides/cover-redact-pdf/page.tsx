import type { Metadata } from "next";
import { SitePage } from "@/components/site-page";

export const metadata: Metadata = {
  title: "How to Cover Information in a PDF",
  description: "Understand visual PDF covers and secure redaction limits.",
};

export default function CoverRedactPdfPage() {
  return (
    <SitePage kicker="Guide" title="How to cover information in a PDF">
      <p>
        Covering content in a PDF is useful when you need a cleaner-looking document for everyday sharing. For example,
        you might cover an old phone number, a typo, a misplaced icon, or a section that no longer applies.
      </p>
      <p>
        A visual cover works by placing a new shape over existing page content. The exported PDF shows that shape, so the
        page looks corrected when opened normally. For neat results, sample the background color near the content, draw a
        box slightly larger than the area, then zoom in to check the edges.
      </p>
      <p>
        Visual covering is different from secure redaction. Some PDFs can contain selectable text, hidden layers,
        comments, form values, attachments, or metadata. A cover box may hide what you see, but it does not prove that all
        underlying sensitive data has been removed from the file.
      </p>
      <p>
        For public files or private information, use a dedicated redaction tool and verify the result before sharing. For
        routine visual cleanup on documents you own, cover boxes are a simple and fast option.
      </p>
    </SitePage>
  );
}
