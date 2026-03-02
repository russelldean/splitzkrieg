import Link from 'next/link';
import { SearchBar } from './SearchBar';
import { MobileNav } from './MobileNav';

const navLinks = [
  { href: '/bowlers', label: 'Bowlers' },
  { href: '/teams', label: 'Teams' },
  { href: '/seasons', label: 'Seasons' },
  { href: '/leaderboards', label: 'Leaderboards' },
];

export function Header() {
  return (
    <header className="bg-cream border-b border-navy/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link
              href="/"
              className="font-heading text-navy uppercase tracking-widest text-lg font-normal hover:text-red transition-colors"
            >
              SPLITZKRIEG
            </Link>
          </div>

          {/* Search Bar — center */}
          <div className="flex-1 max-w-md mx-auto">
            <SearchBar />
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 flex-shrink-0">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-navy font-body text-sm font-medium hover:text-red transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Mobile Nav */}
          <div className="md:hidden flex-shrink-0">
            <MobileNav links={navLinks} />
          </div>
        </div>
      </div>
    </header>
  );
}
