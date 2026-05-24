import type { Metadata } from "next";
import Link from "next/link";
import { SitePage } from "@/components/site-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for PDF Editor.",
};

export default function PrivacyPage() {
  return (
    <SitePage kicker="Privacy" title="Privacy Policy">
      <p>Last updated: May 25, 2026</p>
      <p>
        This Privacy Policy explains how PDF Editor handles information when you use the website and browser-based PDF
        editing tools. Replace the placeholder contact details before publishing this site under a real domain.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Files you open in the editor</h2>
      <p>
        PDF Editor is designed as a browser-first tool. In the current version, PDF files you choose are processed in your
        browser for rendering, editing, previewing, and exporting. The application does not require an account and does
        not intentionally upload your PDF to an application server. Avoid opening files you are not allowed to edit.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Information collected automatically</h2>
      <p>
        Basic hosting logs may be collected by the hosting provider for security, performance, diagnostics, and abuse
        prevention. These logs can include information such as IP address, browser type, device information, referring
        pages, requested URLs, and request times.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Cookies, ads, and third parties</h2>
      <p>
        If advertising is enabled, Google AdSense and its partners may use cookies, local storage, web beacons, IP
        addresses, and similar technologies to serve, measure, personalize, and limit ads. Google may use information
        about visits to this and other sites depending on user settings, consent choices, and applicable law. More detail
        is available in the <Link className="font-medium text-[#146c63] underline" href="/cookies">Cookie Policy</Link>.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Contact messages</h2>
      <p>
        If you contact us by email, we use the information you provide to reply, troubleshoot bugs, improve the service,
        and maintain business records. Do not send private documents unless you are comfortable sharing them.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Data retention</h2>
      <p>
        Browser-processed PDF files are not intentionally stored by the application. Hosting logs and contact emails may
        be kept only as long as reasonably needed for security, support, legal, and business purposes.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Your choices</h2>
      <p>
        You can clear browser storage, block cookies in your browser, adjust Google ad personalization settings, or stop
        using the site. Users in regions with privacy rights may contact us to request access, correction, deletion, or
        other available rights related to personal information we control.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Contact</h2>
      <p>
        Privacy questions can be sent to{" "}
        <a className="font-medium text-[#146c63] underline" href="mailto:hello@yourdomain.com">
          hello@yourdomain.com
        </a>
        .
      </p>
    </SitePage>
  );
}
