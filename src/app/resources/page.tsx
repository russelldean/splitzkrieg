import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Resources',
  description:
    'Quick links and resources for Splitzkrieg Bowling League bowlers.',
};

interface ResourceLink {
  label: string;
  href: string;
  description: string;
}

interface ResourceCategory {
  category: string;
  links: ResourceLink[];
}

const resources: ResourceCategory[] = [
  {
    category: 'League Documents',
    links: [
      {
        label: 'Current Season Spreadsheet',
        href: 'https://docs.google.com/spreadsheets/d/1esTQm815YXB5F9TDOf43V9Pw3_AJ0wZi-MYoE4f2PSg/edit?usp=sharing',
        description: "This season's scores and standings",
      },
      {
        label: 'Master Database (Google Sheets)',
        href: 'https://docs.google.com/spreadsheets/d/1DJUexHWdj3QPLzQtM2wXC5UvHZ97gbDYNmlFUsI3BUI/edit?usp=sharing',
        description: 'Complete league stats and history',
      },
      {
        label: 'League Calendar',
        href: 'https://calendar.google.com/calendar/u/0?cid=MzIzNDU0ZjVlYzM4MzljMGI3MmI4MTczYmFlZGNlMGExNzY3MzMzODM5NTJjNzQ0YjVkMmZmOTZlYWUzMjE2YUBncm91cC5jYWxlbmRhci5nb29nbGUuY29t',
        description: 'Bowling nights and league events',
      },
    ],
  },
  {
    category: 'Bowling Alley',
    links: [
      {
        label: 'Village Lanes',
        href: 'https://www.villagelanes.com',
        description: 'Our home lanes in Durham, NC',
      },
    ],
  },
  {
    category: 'Social',
    links: [
      {
        label: 'Instagram',
        href: 'https://www.instagram.com/splitzkriegbowlingleague/',
        description: 'Follow the league on Instagram',
      },
      {
        label: 'Facebook Group',
        href: 'https://www.facebook.com/groups/27865497820',
        description: 'Join the conversation',
      },
    ],
  },
];

function ExternalLinkIcon() {
  return (
    <svg
      className="w-4 h-4 text-navy/30"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}

export default function ResourcesPage() {
  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header */}
        <div className="mb-10">
          <h1 className="font-heading text-3xl sm:text-4xl text-navy">
            Resources &amp; Quick Links
          </h1>
          <p className="font-body text-navy/50 mt-2 text-lg">
            Everything you need, all in one place. No more hunting through group
            texts.
          </p>
        </div>

        {/* Resource Categories */}
        <div className="space-y-10">
          {resources.map((category) => (
            <section key={category.category}>
              <h2 className="font-heading text-xl text-navy mb-4">
                {category.category}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {category.links.map((link) => {
                  const isPlaceholder = link.href === '#';

                  if (isPlaceholder) {
                    return (
                      <div
                        key={link.label}
                        className="bg-cream-dark rounded-lg p-5 border border-navy/5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-body font-medium text-navy/50">
                              {link.label}
                            </h3>
                            <p className="font-body text-sm text-navy/30 mt-1">
                              {link.description}
                            </p>
                          </div>
                        </div>
                        <span className="inline-block mt-3 font-body text-xs text-navy/30">
                          Link coming soon
                        </span>
                      </div>
                    );
                  }

                  return (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-cream-dark rounded-lg p-5 border border-navy/5 hover:border-navy/15 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-body font-medium text-navy group-hover:text-red transition-colors">
                            {link.label}
                          </h3>
                          <p className="font-body text-sm text-navy/50 mt-1">
                            {link.description}
                          </p>
                        </div>
                        <ExternalLinkIcon />
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
