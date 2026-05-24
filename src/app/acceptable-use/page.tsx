import type { Metadata } from "next";
import { SitePage } from "@/components/site-page";

export const metadata: Metadata = {
  title: "Acceptable Use",
  description: "Acceptable Use Policy for PDF Editor.",
};

export default function AcceptableUsePage() {
  return (
    <SitePage kicker="Policy" title="Acceptable Use Policy">
      <p>Last updated: May 25, 2026</p>
      <p>
        PDF Editor is intended for lawful editing of documents you own, created, or have permission to modify. You are
        responsible for your files and exported documents.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Do not use the service to</h2>
      <p>
        Create, alter, or distribute documents for fraud, impersonation, harassment, deception, copyright infringement,
        evasion of legal duties, or any unlawful purpose.
      </p>
      <p>
        Do not attempt to interfere with the website, bypass security, overload infrastructure, reverse engineer protected
        systems, distribute malware, scrape in abusive ways, or use automated traffic that harms the service.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Sensitive documents</h2>
      <p>
        Be careful with files containing identity documents, financial records, medical information, legal documents, or
        private business data. Visual edits are not a substitute for secure redaction or legal review.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Enforcement</h2>
      <p>
        We may limit, block, or report activity that appears to violate this policy, the Terms of Use, applicable law, or
        platform and advertising policies.
      </p>
    </SitePage>
  );
}
