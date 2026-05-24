import type { Metadata } from "next";
import { SitePage } from "@/components/site-page";

export const metadata: Metadata = {
  title: "Accessibility",
  description: "Accessibility statement for PDF Editor.",
};

export default function AccessibilityPage() {
  return (
    <SitePage kicker="Accessibility" title="Accessibility Statement">
      <p>Last updated: May 25, 2026</p>
      <p>
        PDF Editor aims to provide a simple and usable experience. We are working toward clearer navigation, readable
        contrast, keyboard-friendly controls, and responsive layouts.
      </p>
      <p>
        Some PDF editing interactions, especially direct canvas placement, dragging, resizing, and visual color picking,
        may be difficult with certain assistive technologies. We plan to improve this over time as the product matures.
      </p>
      <p>
        If you find an accessibility issue, email{" "}
        <a className="font-medium text-[#146c63] underline" href="mailto:hello@yourdomain.com">
          hello@yourdomain.com
        </a>{" "}
        with the page, browser, device, assistive technology, and a short description of the problem.
      </p>
    </SitePage>
  );
}
