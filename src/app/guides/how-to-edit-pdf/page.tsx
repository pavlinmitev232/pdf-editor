import type { Metadata } from "next";
import { SitePage } from "@/components/site-page";

export const metadata: Metadata = {
  title: "How to Edit a PDF",
  description: "A practical browser-first workflow for quick PDF edits.",
};

export default function HowToEditPdfPage() {
  return (
    <SitePage kicker="Guide" title="How to edit a PDF in your browser">
      <p>
        The fastest PDF edits are usually visual: hiding an outdated line, adding a correction, replacing a label, or
        covering a blank area before sending a document. A browser-first editor can handle these jobs without a long setup
        or a desktop application.
      </p>
      <p>
        Start by uploading the PDF and choosing the page you want to edit. Zoom to fit the page so you can see placement
        clearly. If you need to cover existing content, use the color picker on the background near the area you want to
        hide, then draw a box over the old content. Matching the nearby color makes the cover look natural.
      </p>
      <p>
        For replacement text, choose the text tool and click where the new text should appear. Type directly on the page,
        adjust the size, and use the color control to match the surrounding content. Preview mode is useful before export
        because it hides the editor outlines and handles.
      </p>
      <p>
        When the document looks right, export a new PDF. Keep the original file as a backup so you can return to it if
        you need a different version later.
      </p>
    </SitePage>
  );
}
