import type { Metadata } from "next";
import { SitePage } from "@/components/site-page";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Cookie Policy for PDF Editor.",
};

export default function CookiePolicyPage() {
  return (
    <SitePage kicker="Cookies" title="Cookie Policy">
      <p>Last updated: May 25, 2026</p>
      <p>
        This Cookie Policy explains how PDF Editor and third-party services may use cookies, local storage, web beacons,
        pixels, and similar technologies.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">What cookies are</h2>
      <p>
        Cookies are small files stored by your browser. Local storage is a browser feature that stores small amounts of
        data on your device. Similar technologies can help websites remember settings, keep services secure, measure use,
        or show ads.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">How this site uses cookies</h2>
      <p>
        The core PDF editor is designed to work without an account. The current app may use only essential browser
        features needed to render and operate the website. Hosting providers may also use security or diagnostic
        technologies to protect and deliver the site.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Advertising cookies</h2>
      <p>
        If Google AdSense is enabled, Google and its partners may use cookies or similar technologies to serve ads,
        personalize ads where allowed, prevent fraud, measure performance, cap ad frequency, and report aggregate ad
        activity. Some ads may be contextual, while others may depend on user settings and consent choices.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">EU, UK, and Switzerland consent</h2>
      <p>
        For users in the European Economic Area, the United Kingdom, and Switzerland, Google requires publishers using
        AdSense to use a Google-certified Consent Management Platform integrated with the IAB Europe Transparency and
        Consent Framework when serving ads. A simple custom cookie banner is not enough for that requirement.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Your choices</h2>
      <p>
        You can block, delete, or limit cookies in your browser settings. Blocking cookies may affect some website
        features. You can also manage Google ad personalization in your Google account and through Google&apos;s ad
        settings tools.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Contact</h2>
      <p>
        Cookie questions can be sent to{" "}
        <a className="font-medium text-[#146c63] underline" href="mailto:hello@yourdomain.com">
          hello@yourdomain.com
        </a>
        .
      </p>
    </SitePage>
  );
}
