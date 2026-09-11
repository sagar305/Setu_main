import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";

const TITLE = "Terms of Use | Setu Technology Tools";
const DESCRIPTION =
  "The terms for using Setu Technology's free business calculators and tools, including how your data is stored on your own device and what we do not warrant.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/terms" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/terms" },
};

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-ink">{heading}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        headline="Terms of Use"
        subheadline="The short set of rules that come with using these tools."
      />

      <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <p className="text-sm text-muted">Last updated 7 September 2026.</p>

        <Section heading="Who we are">
          <p>
            This site is operated by Setu Technology. Using it means accepting these terms. If you
            do not accept them, please do not use the site.
          </p>
        </Section>

        <Section heading="The tools are free, and provided as they are">
          <p>
            The calculators, generators and apps here are offered free of charge and without
            warranty of any kind. They are working tools, not professional advice.
          </p>
          <p>
            <strong>Tax, GST, payroll and financial figures in particular:</strong> rates and rules
            change, and a calculator can only reflect what was correct when it was written. Check
            anything that matters against the current law or with a qualified accountant before you
            rely on it. We are not liable for a decision taken on the strength of a number produced
            here.
          </p>
        </Section>

        <Section heading="Your data is yours, and it is your responsibility">
          <p>
            Work created in these tools is stored in your own browser, not on our servers. That has
            an important consequence: <strong>we hold no copy and cannot recover anything for
            you.</strong> Clearing your browsing data, using private browsing, switching browser or
            switching device will lose it. Export or download anything you need to keep.
          </p>
          <p>
            You are responsible for the accuracy and legality of what you put into the tools,
            including any invoice, bill or record you generate and issue to someone else.
          </p>
        </Section>

        <Section heading="Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Use the site to create false or fraudulent documents.</li>
            <li>Attempt to break, overload or gain unauthorised access to the site or its systems.</li>
            <li>Scrape, resell or redistribute the tools or their content as your own.</li>
          </ul>
        </Section>

        <Section heading="Availability">
          <p>
            We may change, suspend or withdraw any part of the site at any time, without notice.
            Free tools carry no uptime guarantee. Paid products, where you have one, are governed by
            the agreement made at the time of purchase, which takes precedence over these terms.
          </p>
        </Section>

        <Section heading="Other people's sites">
          <p>
            Where we link elsewhere — including to Google, to review pages, or to payment apps — we
            do not control those services and are not responsible for them.
          </p>
        </Section>

        <Section heading="Our content">
          <p>
            The design, text and code of this site belong to Setu Technology. The documents you
            create with the tools belong to you.
          </p>
        </Section>

        <Section heading="Governing law">
          <p>
            These terms are governed by the laws of India, and the courts of India have exclusive
            jurisdiction over any dispute arising from them.
          </p>
        </Section>

        <Section heading="Questions">
          <p>
            Ask through the{" "}
            <Link className="font-semibold text-indigo hover:underline" href="/contact">
              contact page
            </Link>
            . For anything about data, see our{" "}
            <Link className="font-semibold text-indigo hover:underline" href="/privacy">
              Privacy Policy
            </Link>
            .
          </p>
        </Section>
      </div>
    </>
  );
}
