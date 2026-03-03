import Link from 'next/link';
import Image from 'next/image';

const secondaryLinks = [
  { href: '/about', label: 'About' },
  { href: '/rules', label: 'Rules' },
  { href: '/blog', label: 'Blog' },
  { href: '/join', label: 'Join' },
];

export function Footer() {
  return (
    <footer className="bg-cream-dark border-t border-navy/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Secondary Nav */}
        <nav className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 mb-6">
          {secondaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-body font-medium text-navy/60 hover:text-navy transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Branding */}
        <div className="flex flex-col items-center gap-4 pt-4 border-t border-navy/10">
          <Image
            src="/splitzkrieg logo.png"
            alt="Splitzkrieg Bowling League"
            width={200}
            height={72}
            className="h-20 w-auto mix-blend-multiply opacity-60"
          />
          <span className="font-body text-navy/40 text-sm">
            Village Lanes &middot; Durham, NC &middot; Since 2007
          </span>
        </div>
      </div>
    </footer>
  );
}
