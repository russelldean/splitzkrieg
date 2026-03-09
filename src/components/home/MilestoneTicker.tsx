import Link from 'next/link';
import type { TickerItem } from '@/lib/queries';

interface MilestoneTickerProps {
  items: TickerItem[];
}

function TickerIcon({ icon }: { icon: TickerItem['icon'] }) {
  switch (icon) {
    case 'debut':
      return (
        <svg className="w-4 h-4 text-red flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 1ZM5.05 3.05a.75.75 0 0 1 1.06 0l1.062 1.06a.75.75 0 1 1-1.06 1.061L5.05 4.111a.75.75 0 0 1 0-1.06ZM14.95 3.05a.75.75 0 0 1 0 1.06l-1.06 1.062a.75.75 0 0 1-1.062-1.06l1.061-1.062a.75.75 0 0 1 1.06 0ZM3 8a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 3 8ZM14 8a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 14 8ZM7.172 13.828a.75.75 0 0 1 0 1.061l-1.06 1.06a.75.75 0 0 1-1.061-1.06l1.06-1.06a.75.75 0 0 1 1.06 0ZM10 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
        </svg>
      );
    case 'trophy':
      return (
        <svg className="w-4 h-4 text-red flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 1c-1.716 0-3.408.106-5.07.31C3.806 1.45 3 2.414 3 3.517V5.5a4.5 4.5 0 0 0 4.5 4.5h.354c.456.734 1.078 1.342 1.822 1.765A7.97 7.97 0 0 1 8.5 15H7.75a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5H11.5a7.97 7.97 0 0 1-1.176-3.235A4.482 4.482 0 0 0 12.146 10H12.5a4.5 4.5 0 0 0 4.5-4.5V3.517c0-1.103-.806-2.068-1.93-2.207A48.507 48.507 0 0 0 10 1ZM4.5 5.5V3.517c0-.283.215-.536.51-.57A47.007 47.007 0 0 1 10 2.5c1.674 0 3.33.1 4.99.447.195.034.51.287.51.57V5.5a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3Z" clipRule="evenodd" />
        </svg>
      );
    case 'star':
      return (
        <svg className="w-4 h-4 text-red flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clipRule="evenodd" />
        </svg>
      );
    case 'milestone':
      return (
        <svg className="w-4 h-4 text-red flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
        </svg>
      );
    case 'clock':
    default:
      return (
        <svg className="w-4 h-4 text-navy/65 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
        </svg>
      );
  }
}

export function MilestoneTicker({ items = [] }: MilestoneTickerProps) {
  if (items.length === 0) return null;

  return (
    <div className="w-full border-y border-navy/10 bg-cream overflow-hidden shadow-sm">
      <div
        className="flex items-center gap-8 py-3 whitespace-nowrap motion-safe:animate-ticker"
        style={{ width: 'max-content' }}
      >
        {/* Render twice for seamless loop */}
        {[...items, ...items].map((item, i) => (
          <Link
            key={`${item.href}-${item.icon}-${i}`}
            href={item.href}
            className="inline-flex items-center gap-2 text-sm font-body hover:text-red transition-colors"
          >
            <TickerIcon icon={item.icon} />
            <span className="text-navy/70">{item.text}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
