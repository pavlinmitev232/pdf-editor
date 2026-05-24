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
        These Terms of Use govern access to PDF Editor. By using the website, you agree to these terms and to any policies
        linked from this page. If you do not agree, do not use the service.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Permitted use</h2>
      <p>
        Use PDF Editor only with documents you own or have permission to edit. You are responsible for the content you
        upload, modify, export, and share.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Service limitations</h2>
      <p>
        The tool is provided for convenience and may contain bugs or limitations. Visual cover boxes and text overlays are
        intended for presentation edits. They are not a guarantee that underlying PDF content, hidden text, metadata, or
        prior versions have been securely removed.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Prohibited use</h2>
      <p>
        Do not use the service for unlawful activity, fraud, impersonation, copyright infringement, or editing documents
        in a way that misleads others.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">No professional advice</h2>
      <p>
        The service does not provide legal, financial, tax, medical, compliance, or professional advice. You are
        responsible for reviewing your documents and deciding whether the edited result is suitable for your use.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Availability and changes</h2>
      <p>
        The service may change over time as features are added, improved, or removed. Continued use of the site means you
        accept the current version of these terms.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Disclaimer of warranties</h2>
      <p>
        The service is provided as is and as available, without warranties of any kind to the fullest extent permitted by
        law. We do not promise that the service will be uninterrupted, secure, error-free, or suitable for every document.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, PDF Editor and its operators will not be liable for indirect, incidental,
        special, consequential, exemplary, or punitive damages, or for lost profits, lost data, business interruption, or
        document errors arising from use of the service.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Contact</h2>
      <p>
        Terms questions can be sent to{" "}
        <a className="font-medium text-[#146c63] underline" href="mailto:hello@yourdomain.com">
          hello@yourdomain.com
        </a>
        .
      </p>
    </SitePage>
  );
}
