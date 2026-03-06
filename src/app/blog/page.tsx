import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog | Splitzkrieg',
  description: 'News and stories from Splitzkrieg Bowling League.',
};

export default function BlogPage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl text-navy mb-6">
        Blog
      </h1>

      <div className="bg-navy/[0.03] rounded-xl px-8 py-12">
        <div className="font-body text-lg text-navy/70 leading-relaxed space-y-3 max-w-lg mx-auto">
          <p>Weekly Stats emails will go here.</p>
          <p>I&apos;m not sure what else will go here.</p>
          <p>Let&apos;s find out together.</p>
        </div>
      </div>
    </main>
  );
}
