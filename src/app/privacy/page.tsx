import type { Metadata } from "next";
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
        PDF Editor is designed as a browser-first tool. In the current version, PDF files you choose are processed in your
        browser for rendering, editing, previewing, and exporting. The application does not require an account and does
        not intentionally upload your PDF to an application server.
      </p>
      <p>
        Basic hosting logs may be collected by the hosting provider for security, performance, and abuse prevention. These
        logs can include information such as IP address, browser type, device information, referring pages, and request
        times.
      </p>
      <p>
        If advertising is enabled, Google AdSense may use cookies or similar technologies to serve and measure ads. Google
        may use information about your visits to this and other websites to personalize ads, depending on your settings
        and applicable law. You can learn more from Google&apos;s advertising privacy resources.
      </p>
      <p>
        Contact email messages are used to reply to your request and improve the service. Do not send sensitive documents
        through email unless you are comfortable sharing them.
      </p>
    </SitePage>
  );
}
