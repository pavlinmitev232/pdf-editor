import type { Metadata } from "next";
import { SitePage } from "@/components/site-page";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact the PDF Editor team for support, feedback, and site questions.",
};

export default function ContactPage() {
  return (
    <SitePage kicker="Contact" title="Contact PDF Editor">
      <p>
        For support, feedback, bug reports, or business questions, email{" "}
        <a className="font-medium text-[#146c63] underline" href="mailto:hello@yourdomain.com">
          hello@yourdomain.com
        </a>
        .
      </p>
      <p>
        Legal, privacy, copyright, and advertising questions can be sent to the same address. Replace this placeholder
        with the public support email for your domain before launch.
      </p>
      <p>
        Please include the browser you are using, the rough PDF size, and what you were trying to do. Do not email private
        documents unless you are comfortable sharing them.
      </p>
    </SitePage>
  );
}
