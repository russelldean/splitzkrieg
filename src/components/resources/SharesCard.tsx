import Link from 'next/link';

export function SharesCard() {
  return (
    <Link
      href="/splitzkrieg-shares"
      className="bg-white rounded-lg p-5 border border-navy/10 hover:border-navy/20 hover:shadow-sm transition-all group"
    >
      <div>
        <h3 className="font-body font-medium text-navy group-hover:text-red transition-colors">
          Splitzkrieg Shares
        </h3>
        <p className="font-body text-sm text-navy/65 mt-1">
          The free table. One bowler&apos;s junk is another bowler&apos;s treasure.
        </p>
      </div>
    </Link>
  );
}
