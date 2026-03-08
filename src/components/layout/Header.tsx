import Link from 'next/link';
import { SearchBar } from './SearchBar';
import { MobileNav } from './MobileNav';
import { NavDropdown } from './NavDropdown';
import { getCurrentSeasonSnapshot } from '@/lib/queries';

const bowlersIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <circle cx="10" cy="5" r="3" />
    <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" />
  </svg>
);

const teamsIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <circle cx="7" cy="5" r="2.5" />
    <circle cx="13" cy="5" r="2.5" />
    <path d="M2 16c0-2.8 2.2-5 5-5s5 2.2 5 5M8 16c0-2.8 2.2-5 5-5s5 2.2 5 5" />
  </svg>
);

const seasonsIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <rect x="3" y="4" width="14" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <line x1="3" y1="8" x2="17" y2="8" stroke="currentColor" strokeWidth="1.5" />
    <line x1="7" y1="2" x2="7" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="13" y1="2" x2="13" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const leagueNightsIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <circle cx="10" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="10" cy="10" r="1.5" />
    <circle cx="8.5" cy="12.5" r="1" />
    <circle cx="11.5" cy="12.5" r="1" />
  </svg>
);

const statsIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <rect x="2" y="10" width="4" height="8" rx="0.5" />
    <rect x="8" y="4" width="4" height="14" rx="0.5" />
    <rect x="14" y="7" width="4" height="11" rx="0.5" />
  </svg>
);

export async function Header() {
  const snapshot = await getCurrentSeasonSnapshot();
  const currentSeasonSlug = snapshot?.slug ?? null;
  const currentSeasonLabel = snapshot
    ? `Current Season`
    : 'Current Season';
  const thisWeekLabel = snapshot
    ? `This Week`
    : 'This Week';

  const mobileLinks = [
    ...(currentSeasonSlug ? [
      { href: `/week/${currentSeasonSlug}/${snapshot!.weekNumber}`, label: 'This Week\'s Results', icon: leagueNightsIcon },
      { href: `/season/${currentSeasonSlug}`, label: 'Current Standings', icon: seasonsIcon },
    ] : []),
    { href: '/bowlers?filter=current', label: 'Bowlers', icon: bowlersIcon },
    { href: '/teams?filter=current', label: 'Teams', icon: teamsIcon },
    ...(currentSeasonSlug ? [{ href: `/stats/${currentSeasonSlug}`, label: 'Season Stats', icon: statsIcon }] : []),
    { href: '/stats/all-time', label: 'All-Time Stats', icon: statsIcon },
    { href: '/week', label: 'All League Nights', icon: leagueNightsIcon },
    { href: '/seasons', label: 'All Seasons', icon: seasonsIcon },
  ];

  return (
    <header className="bg-cream border-b border-navy/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link
              href="/"
              className="hover:text-red transition-colors"
            >
              <span className="font-heading text-navy uppercase tracking-widest text-xl sm:text-2xl font-normal block leading-none">
                SPLITZKRIEG
              </span>
              <span className="font-body text-[10px] sm:text-xs text-navy/50 tracking-wider uppercase leading-none mt-0.5 block">
                Bowling League &middot; Est. 2007
              </span>
            </Link>
          </div>

          {/* Search Bar — center */}
          <div className="flex-1 max-w-md mx-auto">
            <SearchBar />
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 flex-shrink-0">
            <NavDropdown
              label="League Nights"
              icon={leagueNightsIcon}
              links={[
                ...(currentSeasonSlug && snapshot ? [{ href: `/week/${currentSeasonSlug}/${snapshot.weekNumber}`, label: thisWeekLabel }] : []),
                { href: '/week', label: 'All Weeks' },
              ]}
            />
            <NavDropdown
              label="Seasons"
              icon={seasonsIcon}
              links={[
                ...(currentSeasonSlug ? [{ href: `/season/${currentSeasonSlug}`, label: currentSeasonLabel }] : []),
                { href: '/seasons', label: 'All Seasons' },
              ]}
            />
            <NavDropdown
              label="The Stats"
              icon={statsIcon}
              links={[
                ...(currentSeasonSlug ? [{ href: `/stats/${currentSeasonSlug}`, label: 'Current Season Stats' }] : []),
                { href: '/seasons', label: 'All Season Stats' },
                { href: '/stats/all-time', label: 'All-Time Stats' },
              ]}
            />
            <NavDropdown
              label="Bowlers"
              icon={bowlersIcon}
              links={[
                { href: '/bowlers?filter=current', label: 'Current Bowlers' },
                { href: '/bowlers', label: 'All Bowlers' },
              ]}
            />
            <NavDropdown
              label="Teams"
              icon={teamsIcon}
              links={[
                { href: '/teams?filter=current', label: 'Current Teams' },
                { href: '/teams', label: 'All Teams' },
              ]}
            />
          </nav>

          {/* Mobile Nav */}
          <div className="md:hidden flex items-center gap-2 flex-shrink-0">
            <Link
              href="/"
              className="p-2 text-navy/60 hover:text-red-600 transition-colors"
              aria-label="Home"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M10 2.5L2 9h3v7h4v-4h2v4h4V9h3L10 2.5z" />
              </svg>
            </Link>
            <MobileNav links={mobileLinks} />
          </div>
        </div>
      </div>
    </header>
  );
}
