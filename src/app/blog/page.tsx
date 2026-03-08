import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog | Splitzkrieg',
  description: 'News and stories from Splitzkrieg Bowling League.',
};

export default function BlogPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-heading text-3xl sm:text-4xl text-navy mb-6">
        Blog
      </h1>

      <div className="bg-white rounded-xl border border-navy/10 border-l-4 border-l-navy/30 px-8 py-12 shadow-sm">
        <div className="font-body text-lg text-navy/70 leading-relaxed space-y-3 max-w-lg mx-auto">
          <p>Weekly Stats emails will go here.</p>
          <p>I&apos;m not sure what else will go here.</p>
          <p>Let&apos;s find out together.</p>
        </div>
      </div>
    </main>
  );
}
