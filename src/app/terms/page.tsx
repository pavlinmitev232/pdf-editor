import type { Metadata } from "next";
import { SitePage } from "@/components/site-page";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of use for PDF Editor.",
};

export default function TermsPage() {
  return (
    <SitePage kicker="Terms" title="Terms of Use">
      <p>Last updated: May 25, 2026</p>
      <p>
        Use PDF Editor only with documents you own or have permission to edit. You are responsible for the content you
        upload, modify, export, and share.
      </p>
      <p>
        The tool is provided for convenience and may contain bugs or limitations. Visual cover boxes and text overlays are
        intended for presentation edits. They are not a guarantee that underlying PDF content, hidden text, metadata, or
        prior versions have been securely removed.
      </p>
      <p>
        Do not use the service for unlawful activity, fraud, impersonation, copyright infringement, or editing documents
        in a way that misleads others.
      </p>
      <p>
        The service may change over time as features are added, improved, or removed. Continued use of the site means you
        accept the current version of these terms.
      </p>
    </SitePage>
  );
}
