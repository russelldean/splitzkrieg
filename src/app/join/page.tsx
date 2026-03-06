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
          <p>We are full at the moment, but rosters are fluid and teams are always looking for subs.</p>
          <p>The best place to start is getting on the email list so you get those sub emails and get out to join us one night and see if we are for you.</p>
          <p>I&apos;ll give you the link to the email list and somebody to contact as soon as I figure out how to make sure you aren&apos;t going to send us emails about specials for ductwork.</p>
          <p>For now, your best path to contact us is through our Instagram, linked below.</p>
        </div>
      </div>
    </main>
  );
}
