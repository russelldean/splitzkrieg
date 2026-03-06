import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rules | Splitzkrieg',
  description: 'Splitzkrieg Bowling League rules, scoring, and historical data notes.',
};

export default function RulesPage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl text-navy mb-6">
        Rules
      </h1>

      <div className="space-y-8">
        {/* League Rules */}
        <section className="bg-navy/[0.03] rounded-xl px-8 py-8">
          <div className="font-body text-lg text-navy/70 leading-relaxed space-y-3 max-w-lg mx-auto">
            <p>Rules are important.</p>
            <p>We play by our own rules.</p>
            <p>Meaning, we are not a sanctioned USBC league, not that we are anarchists.</p>
          </div>
        </section>

        {/* Historical Data Note */}
        <section className="bg-navy/[0.03] rounded-xl px-8 py-8">
          <h2 id="numbers" className="font-heading text-xl md:text-2xl text-navy mb-4">
            A Note on the Numbers
          </h2>
          <div className="font-body text-base text-navy/70 leading-relaxed space-y-4">
            <p>
              All historical stats on this site are calculated using our current ruleset.
              This was a deliberate choice - to rely solely on the math and not try
              to dig through every email to recreate what was going on at the time.
              The good part is that everything is measured consistently against the same
              yardstick and you can compare confidently across eras. The side-effect is
              some results will look wacky, because even a little change can have ripple
              effects when you have games decided by a pin or two, or playoff races decided
              by a game or two. This does not mean the original results were a mistake;
              it&rsquo;s just a remnant of 19 years of slightly evolving rules.
            </p>

            <p>Here&rsquo;s what has changed over the years:</p>

            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-navy">Handicap formula.</strong>{' '}
                Our original formula was .95*(200-average), this changed to
                .95*(225-average) to account for the rare times we have bowlers with
                over 200 averages. This then changed to floor(.95*(225-average)), which
                means we drop the remainder when calculating handicap instead of rounding
                to the nearest integer - this is the common practice in other leagues, and
                the change was made to more closely resemble the system at Bowlero.
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
                care about the scores all night long, and it eliminates those nights when
                teams bowl really well and have zero to show for it if they run up against
                a team that bowls out of their minds.
              </li>
              <li>
                <strong className="text-navy">My methods for managing the data.</strong>{' '}
                I started out using an abacus, then went to Commodore 64, and I&rsquo;m
                finally up to typing out the scores on a word processor - I&rsquo;m getting
                a little better at it every day.
              </li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
