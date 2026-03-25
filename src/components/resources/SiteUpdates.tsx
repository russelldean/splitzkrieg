import Link from 'next/link';

interface Update {
  date: string;
  text: string;
  tag: 'fix' | 'feat';
  href?: string;
}

function UpdateRow({ update }: { update: Update }) {
  return (
    <div className="flex items-baseline gap-3 px-5 py-3">
      <span className="font-body text-xs font-medium uppercase tracking-wide text-navy/60 shrink-0">
        {update.tag}
      </span>
      <span className="font-body text-sm text-navy/65 shrink-0">
        {new Date(update.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </span>
      <span className="font-body text-sm text-navy">
        {update.text}
      </span>
      {update.href && (
        <Link href={update.href} className="font-body text-xs font-semibold text-red-600 hover:text-red-700 transition-colors shrink-0">
          Link
        </Link>
      )}
    </div>
  );
}

export function SiteUpdates({ updates, lastUpdated }: { updates: Update[]; lastUpdated?: string }) {
  return (
    <section id="recent-updates" className="mb-10 scroll-mt-20">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-heading text-xl text-navy">
          Site Updates
        </h2>
        {lastUpdated && (
          <span className="font-body text-xs text-navy/60">
            Updated {new Date(lastUpdated + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
      </div>
      <div className="bg-white rounded-lg border border-navy/10">
        <div className="divide-y divide-navy/5 max-h-80 overflow-y-auto">
          {updates.map((update, i) => (
            <UpdateRow key={i} update={update} />
          ))}
        </div>
        {updates.length > 5 && (
          <div className="border-t border-navy/10 bg-navy/[0.03] px-5 py-2 text-center rounded-b-lg">
            <span className="text-xs font-body text-navy/60">Scroll for more updates</span>
          </div>
        )}
      </div>
    </section>
  );
}
