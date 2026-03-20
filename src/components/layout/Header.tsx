import Link from 'next/link';
import { SearchBar } from './SearchBar';
import { MobileNav } from './MobileNav';
import { NavDropdown } from './NavDropdown';
import { DesktopNav, HeaderSearchWrapper, MobileSearchRow } from './DesktopNav';
import { getCurrentSeasonSnapshot, getNextBowlingNight } from '@/lib/queries';
import { bowlersIcon, teamsIcon, seasonsIcon, leagueNightsIcon, blogIcon, statsIcon } from '@/components/ui/icons';

export async function Header() {
  const [snapshot, nextBowlingNight] = await Promise.all([
    getCurrentSeasonSnapshot(),
    getNextBowlingNight(),
  ]);
  const currentSeasonSlug = snapshot?.slug ?? null;
  const currentSeasonLabel = snapshot
    ? `Current Season`
    : 'Current Season';
  const thisWeekLabel = snapshot
    ? `This Week`
    : 'This Week';

  const mobileGroups = [
    ...(currentSeasonSlug && snapshot ? [{
      title: 'This Season',
      icon: leagueNightsIcon,
      links: [
        { href: `/week/${currentSeasonSlug}/${snapshot.weekNumber}`, label: 'This Week\'s Results' },
        { href: `/season/${currentSeasonSlug}`, label: 'Standings' },
        { href: `/stats/${currentSeasonSlug}`, label: 'Season Stats' },
      ],
    }] : []),
    {
      title: 'All Seasons',
      icon: seasonsIcon,
      links: [
        { href: '/week', label: 'All Weeks' },
        { href: '/seasons', label: 'All Seasons' },
        { href: '/stats', label: 'All Season Stats' },
        { href: '/stats/all-time', label: 'All-Time' },
        { href: '/milestones', label: 'Milestone Watch' },
      ],
    },
    {
      title: 'People',
      icon: bowlersIcon,
      links: [
        { href: '/bowlers', label: 'Bowlers' },
        { href: '/teams', label: 'Teams' },
      ],
    },
    {
      title: 'Blog',
      icon: blogIcon,
      links: [
        { href: '/blog', label: 'All Posts' },
      ],
    },
  ];

  return (
    <header className="bg-cream border-b border-navy/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex items-center h-16 gap-4">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link
                href="/"
                className="hover:text-red transition-colors"
              >
                <span className="font-heading text-navy uppercase tracking-widest text-xl sm:text-2xl font-normal block leading-none">
                  SPLITZKRIEG
                </span>
                <span className="font-body text-xs text-navy/80 tracking-wider uppercase leading-none mt-0.5 hidden sm:block">
                  Bowling League &middot; Est. 2007
                </span>
              </Link>
            </div>

            {/* Search Bar — center (hidden on homepage, moves to ticker area) */}
            <HeaderSearchWrapper>
              <SearchBar />
            </HeaderSearchWrapper>

            {/* Desktop Nav */}
            <DesktopNav>
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
                label="Stats"
                icon={statsIcon}
                links={[
                  ...(currentSeasonSlug ? [{ href: `/stats/${currentSeasonSlug}`, label: 'Current Season Stats' }] : []),
                  { href: '/stats', label: 'All Season Stats' },
                  { href: '/stats/all-time', label: 'All-Time' },
                  { href: '/milestones', label: 'Milestone Watch' },
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
              <Link
                href="/blog"
                className="flex items-center gap-1.5 text-sm font-body text-navy/70 hover:text-navy transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                </svg>
                Blog
              </Link>
            </DesktopNav>

            {/* Spacer pushes mobile nav to the right */}
            <div className="flex-1 md:hidden" />

            {/* Mobile Nav */}
            <div className="md:hidden flex-shrink-0">
              <MobileNav groups={mobileGroups} />
            </div>
          </div>

          {/* Mobile search bar — full width below header row */}
          <MobileSearchRow>
            <SearchBar />
          </MobileSearchRow>
        </div>
    </header>
  );
}
