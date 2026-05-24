import Link from "next/link";
import type { ReactNode } from "react";
import { SitePage } from "@/components/site-page";

type SeoToolPageProps = {
  kicker: string;
  title: string;
  intro: string;
  steps: string[];
  children: ReactNode;
};

export function SeoToolPage({ kicker, title, intro, steps, children }: SeoToolPageProps) {
  return (
    <SitePage kicker={kicker} title={title}>
      <p>{intro}</p>
      <div className="rounded-md border border-[#ded8cc] bg-[#fffdfa] p-5">
        <h2 className="text-2xl font-semibold text-[#211f1c]">How it works</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <Link
          className="mt-5 inline-flex rounded-md bg-[#146c63] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f5e56]"
          href="/"
        >
          Open the editor
        </Link>
      </div>
      {children}
    </SitePage>
  );
}

