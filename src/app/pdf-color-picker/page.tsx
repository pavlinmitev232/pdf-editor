import type { Metadata } from "next";
import { SeoToolPage } from "@/components/seo-tool-page";

export const metadata: Metadata = {
  title: "PDF Color Picker",
  description: "Pick a color from a PDF page and use it for cover boxes so edits blend into the document.",
  alternates: {
    canonical: "/pdf-color-picker",
  },
};

export default function PdfColorPickerPage() {
  return (
    <SeoToolPage
      kicker="Color matching"
      title="Pick colors from a PDF page"
      intro="The PDF color picker samples the rendered page so you can create cover boxes that match the local background color."
      steps={[
        "Upload a PDF.",
        "Select Pick color.",
        "Click a clean background area near the edit.",
        "Draw a cover box using the sampled color.",
        "Preview the result before exporting.",
      ]}
    >
      <h2 className="text-2xl font-semibold text-[#211f1c]">Why exact color helps</h2>
      <p>
        PDF backgrounds are often not pure white. Scanned pages, compressed images, anti-aliased text, and design templates
        can use subtle gray or off-white tones. Sampling nearby pixels makes visual covers less obvious.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Sampling tip</h2>
      <p>
        Click a plain area, not a letter edge, shadow, border, icon, or gradient. If the match looks wrong, sample again
        from another nearby spot.
      </p>
    </SeoToolPage>
  );
}

