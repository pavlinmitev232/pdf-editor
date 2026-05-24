import type { Metadata } from "next";
import { SitePage } from "@/components/site-page";

export const metadata: Metadata = {
  title: "Copyright",
  description: "Copyright and intellectual property policy for PDF Editor.",
};

export default function CopyrightPage() {
  return (
    <SitePage kicker="Copyright" title="Copyright and intellectual property">
      <p>Last updated: May 25, 2026</p>
      <p>
        PDF Editor respects intellectual property rights. Use the service only with documents you own, created, licensed,
        or have permission to edit.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">User responsibility</h2>
      <p>
        You are responsible for ensuring that your use of documents, images, logos, fonts, icons, templates, and other
        materials complies with copyright, trademark, privacy, publicity, and other applicable rights.
      </p>
      <h2 className="text-2xl font-semibold text-[#211f1c]">Copyright complaints</h2>
      <p>
        If you believe content connected with PDF Editor infringes your rights, email{" "}
        <a className="font-medium text-[#146c63] underline" href="mailto:hello@yourdomain.com">
          hello@yourdomain.com
        </a>{" "}
        with enough information to identify the work, the alleged infringement, your contact details, and a statement that
        you have a good-faith belief the use is not authorized.
      </p>
      <p>
        This page is a practical contact policy and should be reviewed by counsel before you rely on it as a formal DMCA
        process or equivalent legal notice procedure.
      </p>
    </SitePage>
  );
}
