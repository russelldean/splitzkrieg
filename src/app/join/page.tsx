import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How to Join | Splitzkrieg',
  description: 'Interested in joining Splitzkrieg Bowling League? Here is how.',
};

export default function JoinPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-heading text-3xl sm:text-4xl text-navy mb-6">
        How to Join
      </h1>

      <div className="bg-white rounded-xl border border-navy/10 border-l-4 border-l-red-600/40 px-8 py-12 shadow-sm">
        <div className="font-body text-lg text-navy/70 leading-relaxed space-y-3 max-w-lg mx-auto">
          <p>The league is full at the moment, but rosters are fluid and teams are always looking for subs.</p>
          <p>The best place to start for now is dropping us a line on our <a href="https://www.instagram.com/splitzkriegbowlingleague/" target="_blank" rel="noopener noreferrer" className="text-navy underline underline-offset-2 hover:text-red transition-colors">Instagram</a> - include your email if you are willing to be added to the email list, so you can receive league updates and sub requests.</p>
        </div>
      </div>
    </main>
  );
}
