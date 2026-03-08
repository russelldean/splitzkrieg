import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How to Join | Splitzkrieg',
  description: 'Interested in joining Splitzkrieg Bowling League? Here is how.',
};

export default function JoinPage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl text-navy mb-6">
        How to Join
      </h1>

      <div className="bg-navy/[0.03] rounded-xl px-8 py-12">
        <div className="font-body text-lg text-navy/70 leading-relaxed space-y-3 max-w-lg mx-auto">
          <p>The league is full at the moment, but rosters are fluid and teams are always looking for subs.</p>
          <p>The best place to start for now is dropping us a line on our <a href="https://www.instagram.com/splitzkriegbowlingleague/" target="_blank" rel="noopener noreferrer" className="text-navy underline underline-offset-2 hover:text-red transition-colors">Instagram</a> - include your email if you are willing to be added to the email list, so you can receive league updates and sub requests.</p>
        </div>
      </div>
    </main>
  );
}
