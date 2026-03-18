import Link from 'next/link';
import type { Metadata } from 'next';
import { ParallaxBg } from '@/components/ui/ParallaxBg';
import { BackToHome } from '@/components/ui/BackToHome';


import { SiteUpdates } from '@/components/resources/SiteUpdates';
import { SharesCard } from '@/components/resources/SharesCard';
import { getSiteUpdates } from '@/lib/queries/updates';

export const metadata: Metadata = {
  title: 'Extras',
  description:
    'Quick links, extras, and hidden gems for Splitzkrieg Bowling League bowlers.',
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
        label: 'Lineup Submission',
        href: '/lineup',
        description: 'Captains: submit your weekly lineup here',
      },
      {
        label: 'League Calendar',
        href: 'https://calendar.google.com/calendar/u/0?cid=MzIzNDU0ZjVlYzM4MzljMGI3MmI4MTczYmFlZGNlMGExNzY3MzMzODM5NTJjNzQ0YjVkMmZmOTZlYWUzMjE2YUBncm91cC5jYWxlbmRhci5nb29nbGUuY29t',
        description: 'Bowling nights and league events',
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
        description: 'Follow the league on Facebook',
      },
    ],
  },
  {
    category: 'Hidden Gems',
    links: [
      {
        label: 'Splitzkrieg Shares',
        href: '/splitzkrieg-shares',
        description: 'The free table. One bowler\'s junk is another bowler\'s treasure.',
      },
      {
        label: 'Village Lanes',
        href: '/village-lanes',
        description: 'Where it all started. Durham, NC.',
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

export default async function ResourcesPage() {
  const updates = await getSiteUpdates();
  const lastUpdated = updates.length > 0 ? updates[0].date : undefined;
  return (
    <div className="min-h-screen bg-cream">
      <section className="relative overflow-hidden h-36 sm:h-44" role="img" aria-label="Splitzkrieg CRASH parade truck with bowling pins">
        <ParallaxBg
          src="/splitzkrieg-crash-truck.jpg"
          imgW={960} imgH={720}
          focalY={0.4}
          maxW={960}
          mobileSrc="/splitzkrieg-crash-truck.jpg"
          mobileFocalY={0.5}
          mobileImgW={960} mobileImgH={720}
        />
        <div className="absolute inset-0 z-[1] bg-navy/15" />
        <div className="absolute inset-0 z-[1] bg-gradient-to-r from-navy/40 via-transparent to-navy/40 sm:from-navy/70 sm:via-transparent sm:to-navy/70" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end pb-6">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl text-white drop-shadow-lg">Extras</h1>
            <p className="font-body text-white/85 text-sm mt-1 drop-shadow">Site updates, social links, and hidden gems.</p>
          </div>
        </div>
      </section>
      <BackToHome />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Site Updates */}
        <SiteUpdates updates={updates} lastUpdated={lastUpdated} />


        {/* Resource Categories */}
        <div className="space-y-10">
          {resources.map((category) => (
            <section key={category.category}>
              <h2 className="font-heading text-xl text-navy mb-4">
                {category.category}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {category.links.map((link) => {
                  if (link.href === '/splitzkrieg-shares') {
                    return <SharesCard key={link.label} />;
                  }

                  if (link.href === '/village-lanes') {
                    const neonGlow = '0 0 2px #fff, 0 0 7px rgba(91,184,255,1), 0 0 14px rgba(59,130,246,0.9), 0 0 28px rgba(59,130,246,0.5), 0 0 42px rgba(59,130,246,0.25)';
                    const neonFont = { fontFamily: "'Trebuchet MS', 'Arial Narrow', sans-serif", fontWeight: 300 as const, letterSpacing: '0.15em' };
                    return (
                      <Link key={link.label} href={link.href} className="relative overflow-hidden rounded-lg p-5 border border-navy/10 bg-white hover:border-navy/20 hover:shadow-sm transition-all group">
                        <div className="relative z-10">
                          {/* Title line: Village Lanes neon sign, then "the original", then Party Zone photo */}
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            {/* VILLAGE LANES neon sign */}
                            <div
                              className="bg-[#0a0a1a] rounded px-2 py-0 inline-flex items-baseline whitespace-nowrap"
                              style={{ ...neonFont, transform: 'rotate(2deg)', boxShadow: '0 0 10px rgba(59,130,246,0.5), 0 0 20px rgba(59,130,246,0.3), 0 0 40px rgba(59,130,246,0.15)' }}
                            >
                              <span className="text-lg sm:text-xl uppercase text-[#a0d8ff]" style={{ textShadow: neonGlow }}>VILLAGE</span>
                              <span className="inline-block w-2"></span>
                              <span className="text-lg sm:text-xl uppercase text-[#a0d8ff] inline-block" style={{ textShadow: neonGlow }}>L</span>
                              <span className="text-lg sm:text-xl uppercase text-[#a0d8ff] inline-block" style={{ transform: 'rotate(1.5deg) translateY(2px)', textShadow: neonGlow }}>A</span>
                              <span className="text-lg sm:text-xl uppercase text-[#a0d8ff] inline-block" style={{ transform: 'rotate(3deg) translateY(4px)', textShadow: neonGlow }}>N</span>
                              <span className="text-lg sm:text-xl uppercase text-[#a0d8ff] inline-block" style={{ transform: 'rotate(5deg) translateY(5px)', textShadow: neonGlow }}>E</span>
                              <span className="text-lg sm:text-xl uppercase text-[#a0d8ff] inline-block" style={{ transform: 'rotate(6deg) translateY(7px)', textShadow: neonGlow }}>S</span>
                            </div>
                          </div>
                          <div className="relative mt-2">
                            <p className="font-body text-base text-navy/65">Our original home</p>
                            {/* PARTY ZONE sign covers "Our original home" when it flickers on */}
                            <div className="absolute inset-0 flex items-center pl-[22%] animate-[neon-swap-b_8s_ease-in-out_infinite]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src="/party-zone-sign.png"
                                alt=""
                                className="w-[60%] h-auto drop-shadow-[0_0_12px_rgba(59,130,246,0.7)]"
                              />
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  }

                  const isPlaceholder = link.href === '#';

                  if (isPlaceholder) {
                    return (
                      <div
                        key={link.label}
                        className="bg-white rounded-lg p-5 border border-navy/10"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-body font-medium text-navy/60">
                              {link.label}
                            </h3>
                            <p className="font-body text-sm text-navy/60 mt-1">
                              {link.description}
                            </p>
                          </div>
                        </div>
                        <span className="inline-block mt-3 font-body text-xs text-navy/60">
                          Link coming soon
                        </span>
                      </div>
                    );
                  }

                  const isInternal = link.href.startsWith('/');
                  const cardClass = "bg-white rounded-lg p-5 border border-navy/10 hover:border-navy/20 hover:shadow-sm transition-all group";
                  const cardContent = (
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-body font-medium text-navy group-hover:text-red transition-colors">
                          {link.label}
                        </h3>
                        <p className="font-body text-sm text-navy/65 mt-1">
                          {link.description}
                        </p>
                      </div>
                      {!isInternal && <ExternalLinkIcon />}
                    </div>
                  );

                  if (isInternal) {
                    return (
                      <Link key={link.label} href={link.href} className={cardClass}>
                        {cardContent}
                      </Link>
                    );
                  }

                  return (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cardClass}
                    >
                      {cardContent}
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
