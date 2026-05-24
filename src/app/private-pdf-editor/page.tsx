import type { Metadata } from "next";
import { SeoToolPage } from "@/components/seo-tool-page";

export const metadata: Metadata = {
  title: "Private PDF Editor",
  description: "A private browser PDF editor for quick edits without intentionally uploading your PDF to an application server.",
  alternates: {
    canonical: "/private-pdf-editor",
  },
};

export default function PrivatePdfEditorPage() {
  return (
    <SeoToolPage
      kicker="Private PDF editing"
      title="Private PDF editor that runs in your browser"
      intro="Patch PDF is designed for local browser editing. In the current MVP, your PDF is rendered, edited, and exported on your device."
      steps={[
        "Open the editor in a modern browser.",
        "Upload a PDF from your device.",
        "Make visual edits locally in the page.",
        "Export the edited file from your browser.",
        "Keep the original PDF as your backup.",
      ]}
    >
      <h2 className="text-2xl font-semibold text-[#211f1c]">Why browser-first matters</h2>
      <p>
        Many online PDF tools upload documents to a server before processing. Browser-first tools reduce that exposure for
        simple edits because the document can stay inside the local browser session.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Still use judgment</h2>
      <p>
        Avoid opening highly sensitive documents in any web app unless you understand the risk. For legal, medical,
        financial, or compliance documents, verify the exported file carefully before sharing.
      </p>
    </SeoToolPage>
  );
}

