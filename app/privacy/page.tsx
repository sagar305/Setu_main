import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { AnalyticsOptOut } from "@/components/analytics/AnalyticsOptOut";

const TITLE = "Privacy Policy | Setu Technology";
const DESCRIPTION =
  "What Setu Technology measures and what it never sees: your invoices, statements and billing data stay on your device. Read how to opt out.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/privacy" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/privacy" },
};

/** Where to write about anything on this page. */
const PRIVACY_CONTACT = "privacy@setutechnology.com";

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-ink">{heading}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        headline="Privacy Policy"
        subheadline="What we measure, what we deliberately cannot see, and how to switch it off."
      />

      <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <p className="text-sm text-muted">Last updated 7 September 2026.</p>

        <Section heading="The short version">
          <p>
            The calculators and tools on this site do their work inside your browser. Invoices,
            quotations, bank statements, bills, patient notes and fee records are written to
            storage on your own device and are never uploaded to us. We cannot read them, we
            cannot recover them for you, and clearing your browser data deletes them for good.
          </p>
          <p>
            Separately, we count how the site is used — which pages open, which buttons are
            pressed — so we know which tools are worth improving. That measurement never
            includes anything you type.
          </p>
        </Section>

        <Section heading="What we record">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Pages opened, and the page you arrived from.</li>
            <li>
              Buttons and links pressed — identified by the name we give them in our own code,
              such as &ldquo;download invoice PDF&rdquo;, never by what they contain on screen.
            </li>
            <li>How far down a page you scrolled, and roughly how long you stayed.</li>
            <li>Whether the device is a phone or a computer, and which country the request came from.</li>
            <li>A random identifier stored in your browser, so a repeat visit is recognisable as a repeat visit.</li>
            <li>Error messages when something on the site breaks.</li>
          </ul>
        </Section>

        <Section heading="What we never record">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Anything typed into a calculator, generator or app on this site.</li>
            <li>The contents of invoices, quotations, menus, bills, statements or records.</li>
            <li>Uploaded files. Bank statement PDFs are read in your browser and never sent to us.</li>
            <li>Your name, phone number or email, unless you type them into the contact or demo form yourself.</li>
            <li>
              Your IP address. It reaches our server as part of any web request, is used only to
              work out the country, and is never written to storage.
            </li>
          </ul>
        </Section>

        <Section heading="Who else sees it">
          <p>
            Usage measurement is processed by <strong>PostHog</strong> (analytics),{" "}
            <strong>Google Analytics</strong> (analytics, which sets a cookie in your browser) and{" "}
            <strong>Vercel</strong>, who host the site and provide cookie-free traffic and
            performance figures. Each receives the events described above and nothing else.
          </p>
          <p>
            When you submit the contact or demo form, what you wrote is emailed to us through{" "}
            <strong>Resend</strong>. We do not sell data to anyone, and we do not use it for
            advertising.
          </p>
        </Section>

        <Section heading="How long we keep it">
          <p>
            Individual usage events are deleted after 14 months. Summary figures — visits per
            month, which tools were used — are kept indefinitely, because they contain nothing
            that could identify anyone. Contact and demo enquiries are kept as email for as long
            as we may need to answer them.
          </p>
        </Section>

        <Section heading="Turning it off">
          <p>
            You can opt out of usage measurement below. We also honour the browser-level
            &ldquo;Do Not Track&rdquo; and Global Privacy Control settings automatically, so if
            you have already set either of those, nothing here is recording you.
          </p>
          <div className="pt-2">
            <AnalyticsOptOut />
          </div>
        </Section>

        <Section heading="Your rights">
          <p>
            Under India&rsquo;s Digital Personal Data Protection Act, 2023 you may ask what
            personal data of yours we hold, ask us to correct or erase it, and complain about how
            we have handled it. Because usage measurement is tied to a random browser identifier
            rather than to you, we usually cannot connect it to a person even if asked — opting
            out above, or clearing your site data, is the faster remedy.
          </p>
          <p>
            Data protection queries and grievances:{" "}
            <a className="font-semibold text-indigo hover:underline" href={`mailto:${PRIVACY_CONTACT}`}>
              {PRIVACY_CONTACT}
            </a>
            . We reply within 30 days.
          </p>
        </Section>

        <Section heading="Children">
          <p>
            These are tools for running a business and are not directed at children. We do not
            knowingly collect data from anyone under 18.
          </p>
        </Section>

        <Section heading="Changes">
          <p>
            If this policy changes we will update the date at the top of this page. Continuing to
            use the site after a change means the updated policy applies.
          </p>
          <p>
            See also our{" "}
            <Link className="font-semibold text-indigo hover:underline" href="/terms">
              Terms of Use
            </Link>
            .
          </p>
        </Section>
      </div>
    </>
  );
}
