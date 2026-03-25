import type { Metadata } from 'next';
import { ParallaxBg } from '@/components/ui/ParallaxBg';
import { BackToHome } from '@/components/ui/BackToHome';

export const metadata: Metadata = {
  title: 'How to Join | Splitzkrieg',
  description: 'Interested in joining Splitzkrieg Bowling League? Here is how.',
};

export default function JoinPage() {
  return (
    <>
      <section className="relative overflow-hidden h-36 sm:h-44" role="img" aria-label="Vintage AS-80 scoring console at Village Lanes">
        <ParallaxBg
          src="/splitzkrieg-stickers-wide.jpg"
          imgW={2016} imgH={1512}
          focalY={0.55}
          maxW={2016}
        />
        <div className="absolute inset-0 z-[1] bg-navy/15" />
        <div className="absolute inset-0 z-[1] bg-gradient-to-r from-navy/40 via-transparent to-navy/40 sm:from-navy/70 sm:via-transparent sm:to-navy/70" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end pb-6">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl text-white drop-shadow-lg">How to Join</h1>
          </div>
        </div>
      </section>
    <BackToHome />
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

      <div className="bg-white rounded-xl border border-navy/10 shadow-sm border-l-4 border-l-red-600/40 px-8 py-12 shadow-sm">
        <div className="font-body text-lg text-navy/70 leading-relaxed space-y-3 max-w-lg mx-auto">
          <p>The league is full at the moment, but rosters are fluid and teams are always looking for subs.</p>
          <p>The best place to start for now is dropping us a line on our <a href="https://www.instagram.com/splitzkriegbowlingleague/" target="_blank" rel="noopener noreferrer" className="text-navy underline underline-offset-2 hover:text-red transition-colors">Instagram</a> - include your email if you are willing to be added to the email list, so you can receive league updates and sub requests.</p>
        </div>
      </div>
    </main>
    </>
  );
}
