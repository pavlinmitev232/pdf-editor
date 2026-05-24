import type { Metadata } from "next";
import { SitePage } from "@/components/site-page";

export const metadata: Metadata = {
  title: "How PDF Color Matching Works",
  description: "Why exact color sampling helps PDF cover boxes blend into the page.",
};

export default function PdfColorPickerPage() {
  return (
    <SitePage kicker="Guide" title="How PDF color matching works">
      <p>
        PDF pages often look white at a glance, but many documents use slightly tinted backgrounds, compressed images, or
        anti-aliased edges. A cover box that uses pure white can stand out if the original page is actually warm gray,
        off-white, or part of a scanned image.
      </p>
      <p>
        The color picker samples the rendered page in the browser and converts that pixel into a hex color. You can use
        that color for a cover box so the new shape blends with the surrounding area. This is especially useful for
        resumes, invoices, forms, and designs that use subtle background tones.
      </p>
      <p>
        For best results, click on a clean area close to the content you want to cover. Avoid letters, shadows, page
        borders, and image edges unless you intentionally want to sample that color. If the first sample looks wrong,
        sample again from a nearby pixel and redraw or recolor the box.
      </p>
      <p>
        Exact color matching makes visual edits cleaner, but it cannot recreate complex textures or gradients perfectly.
        In those cases, use smaller boxes, align them carefully, and preview the page before exporting.
      </p>
    </SitePage>
  );
}
