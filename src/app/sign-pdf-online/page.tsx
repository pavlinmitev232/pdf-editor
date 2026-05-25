import type { Metadata } from "next";
import { SeoToolPage } from "@/components/seo-tool-page";

export const metadata: Metadata = {
  title: "Sign PDF Online",
  description: "Sign a PDF online by drawing a signature or uploading a signature image, then place it on the page and export.",
  alternates: {
    canonical: "/sign-pdf-online",
  },
};

export default function SignPdfOnlinePage() {
  return (
    <SeoToolPage
      kicker="PDF signature"
      title="Sign a PDF online"
      intro="Patch PDF lets you add a signature to a PDF in your browser. You can draw a signature directly or upload a photo of a real signature and place it on the page."
      steps={[
        "Upload the PDF you want to sign.",
        "Choose Scan signature to upload a signature image, or Draw signature to write one on screen.",
        "Move and resize the signature overlay on the PDF.",
        "Preview the page.",
        "Export the signed PDF.",
      ]}
    >
      <h2 className="text-2xl font-semibold text-[#211f1c]">Signature image cleanup</h2>
      <p>
        When you upload a dark signature on light paper, Patch PDF tries to remove the paper background and crop around
        the ink so the signature can sit naturally on the document.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Use with permission</h2>
      <p>
        Only sign documents you are allowed to sign. For contracts, legal forms, or regulated workflows, verify whether a
        simple visual signature is accepted before relying on it.
      </p>
    </SeoToolPage>
  );
}

