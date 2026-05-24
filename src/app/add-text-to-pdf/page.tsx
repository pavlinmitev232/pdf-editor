import type { Metadata } from "next";
import { SeoToolPage } from "@/components/seo-tool-page";

export const metadata: Metadata = {
  title: "Add Text to PDF Online",
  description: "Add text to a PDF page in your browser, adjust the text color and size, then export a new PDF.",
  alternates: {
    canonical: "/add-text-to-pdf",
  },
};

export default function AddTextToPdfPage() {
  return (
    <SeoToolPage
      kicker="PDF text"
      title="Add text to a PDF online"
      intro="Use Patch PDF to click anywhere on a PDF page and place editable text. You can type directly on the page, change the color, adjust the size, and export the result."
      steps={[
        "Upload your PDF.",
        "Choose the Text tool.",
        "Click the page where the text should appear.",
        "Type directly on the PDF and adjust color or size.",
        "Export the edited PDF.",
      ]}
    >
      <h2 className="text-2xl font-semibold text-[#211f1c]">When to use this</h2>
      <p>
        Adding text is useful for filling simple blanks, correcting small labels, adding a note, or replacing text you
        covered with a matched background box.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Tip for natural-looking edits</h2>
      <p>
        Match the text color and size to the surrounding PDF content. If you need to replace existing text, cover the old
        text first, then place the new text on top.
      </p>
    </SeoToolPage>
  );
}

