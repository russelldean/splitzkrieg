import type { Metadata } from 'next';
import { ParallaxBg } from '@/components/ui/ParallaxBg';

export const metadata: Metadata = {
  title: 'Rules | Splitzkrieg',
  description: 'Splitzkrieg Bowling League rules, scoring, and historical data notes.',
};

export default function RulesPage() {
  return (
    <>
      <section className="relative overflow-hidden h-36 sm:h-44" role="img" aria-label="Bowler releasing ball at Village Lanes">
        <ParallaxBg
          src="/village-lanes-panorama.jpg"
          imgW={1996} imgH={638}
          focalY={0.5}
          mobileSrc="/village-lanes-action.jpg"
          mobileFocalY={0.35}
          mobileImgW={1152} mobileImgH={1152}
        />
        <div className="absolute inset-0 z-[1] bg-navy/15" />
        <div className="absolute inset-0 z-[1] bg-gradient-to-r from-navy/40 via-transparent to-navy/40 sm:from-navy/70 sm:via-transparent sm:to-navy/70" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end pb-6">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl text-white drop-shadow-lg">Rules</h1>
          </div>
        </div>
      </section>
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

      <div className="space-y-8">
        {/* League Rules */}
        <section className="bg-white rounded-xl border border-navy/10 border-l-4 border-l-red-600/40 px-8 py-8 shadow-sm">
          <div className="font-body text-lg text-navy/70 leading-relaxed space-y-3 max-w-lg mx-auto">
            <p>Rules are important.</p>
            <p>We play by our own rules.</p>
            <p>Meaning, we are not a sanctioned USBC league, not that we are anarchists.</p>
          </div>
        </section>

        {/* Historical Data Note */}
        <section className="bg-white rounded-xl border border-navy/10 border-l-4 border-l-navy/30 px-8 py-8 shadow-sm">
          <h2 id="numbers" className="font-heading text-xl md:text-2xl text-navy mb-4">
            A Note on the Numbers
          </h2>
          <div className="font-body text-base text-navy/70 leading-relaxed space-y-4">
            <p>
              All historical stats on this site are calculated using our current ruleset.
              This is a deliberate choice to rely solely on the math and not dig through
              every email to recreate what was reported at the time. This means everything
              is measured consistently against the same yardstick and you can compare
              confidently across eras. The side-effect is some results may look wacky &mdash;
              even a little change can have ripple effects when there are games decided by
              a pin or two, or playoff races decided by a game or two. This does not mean
              the original results were a mistake; it&rsquo;s just a remnant of 19 years
              of slightly evolving rules.
            </p>

            <p>Here&rsquo;s what has changed over the years:</p>

            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-navy">Handicap formula.</strong>{' '}
                Our original formula was <strong className="text-navy">.95*(200-average)</strong>, this changed to
                <strong className="text-navy">.95*(225-average)</strong> to account for the rare times we have bowlers with
                over 200 averages. This then changed to <strong className="text-navy">floor(.95*(225-floor(average)))</strong>, which
                means we drop the remainder on the average first, then calculate handicap
                and drop the remainder again.  This change was made to align with common practice
                and match the system at Bowlero.
              </li>
              <li>
                <strong className="text-navy">Penalties and missing bowlers.</strong>{' '}
                There were many different ways I handled missing bowlers in our early
                seasons, including deducting 20 pins from the missing bowler&rsquo;s
                average. At some point I landed on the current 199 across the board
                penalty score - it&rsquo;s easier to keep track of, and more importantly,
                if you have a missing bowler, how do you determine which bowler is the
                one that is missing? Derp.
              </li>
              <li>
                <strong className="text-navy">Standings.</strong>{' '}
                I began by just counting wins and losses, then I changed it to 2 pts per
                win and 1 pt for the highest team in the match, and then I changed to the
                system we have now where extra points are determined by how your team did
                against all the other teams that night. This gives every team a reason to
                care about their scores all night long, and it eliminates those nights when
                a team bowls really well and has zero to show for it, because they happen
                to run up against a team that bowls out of their minds.
              </li>
              <li>
                <strong className="text-navy">Individual playoffs.</strong>{' '}
                For the first 5 seasons, bowlers could qualify for both the Scratch
                and Handicap playoffs. For the first 7 seasons, the Women&rsquo;s
                Scratch playoff was not held. In practice, not
                everyone who qualified could always make it to playoff night, and
                alternates would step in &mdash; but for record-keeping purposes,
                the top 8 in each category are recorded as making the playoffs.
              </li>
              <li>
                <strong className="text-navy">My data management.</strong>{' '}
                I started out with an abacus, then moved to a Commodore 64, and I&rsquo;ve
                finally got a word processor &mdash; getting a little better every day.
              </li>
            </ul>
          </div>
        </section>
      </div>
    </main>
    </>
  );
}
