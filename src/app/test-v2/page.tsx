/* VARIANT 2: No logo at top, prominent logo in footer area */
import Link from 'next/link';
import Image from 'next/image';
import { ParallaxBg } from '@/components/ui/ParallaxBg';
import { formatMatchDate } from '@/lib/bowling-time';
import {
  getWeeklyHighlights,
  getCurrentSeasonSnapshot,
  getNextBowlingNights,
  getSeasonBySlug,
  getSeasonStandings,
  getSeasonSchedule,
  getSeasonMatchResults,
  getLeagueMilestones,
  milestoneTickerItems,
  getNewBlogBadgeId,
} from '@/lib/queries';
import { getPostBySlug, getAllPosts } from '@/lib/blog';
import { MilestoneTicker } from '@/components/home/MilestoneTicker';
import { SeasonSnapshot } from '@/components/home/SeasonSnapshot';
import { MiniStandings } from '@/components/home/MiniStandings';
import { ThisWeekMatchups } from '@/components/home/ThisWeekMatchups';
import { InlineCountdown } from '@/components/home/InlineCountdown';
import { PromotedBlogCard } from '@/components/home/PromotedBlogCard';
import { TrackVisibility } from '@/components/tracking/TrackVisibility';
import { InstagramStrip } from '@/components/home/InstagramStrip';
import { RecapSnapshotCard } from '@/components/home/RecapSnapshotCard';
import { getInstagramFeed } from '@/lib/queries/instagram';


export const metadata = {
  title: 'V2: Logo in Footer',
};

export default async function HomeV2() {
  const [seasonSnapshot, weeklyHighlights, bowlingNights, leagueMilestones, blogBadgeId, instagramPosts, allPosts] = await Promise.all([
    getCurrentSeasonSnapshot(),
    getWeeklyHighlights(),
    getNextBowlingNights(),
    getLeagueMilestones(),
    getNewBlogBadgeId(),
    getInstagramFeed(6),
    getAllPosts(),
  ]);

  const latestPost = allPosts[0] ?? null;
  const promotedSlug = blogBadgeId?.split('|')[0] ?? null;
  const promotedPost = promotedSlug ? await getPostBySlug(promotedSlug) : undefined;
  const [nextBowlingNight, followingBowlingNight] = bowlingNights;

  const allTickerItems = [...weeklyHighlights, ...milestoneTickerItems(leagueMilestones)]
    .sort((a, b) => a.text.localeCompare(b.text));

  let standings: Awaited<ReturnType<typeof getSeasonStandings>> = [];
  let weekSchedule: Awaited<ReturnType<typeof getSeasonSchedule>> = [];
  let nextWeekNumber = 0;
  let latestWeekDate: string | null = null;

  if (seasonSnapshot) {
    const season = await getSeasonBySlug(seasonSnapshot.slug);
    if (season) {
      const [allStandings, allSchedule, allMatchResults] = await Promise.all([
        getSeasonStandings(season.seasonID),
        getSeasonSchedule(season.seasonID),
        getSeasonMatchResults(season.seasonID),
      ]);
      standings = allStandings;
      const playedWeeks = new Set(allMatchResults.map(r => r.week));
      const scheduledWeeks = [...new Set(allSchedule.map(s => s.week))].sort((a, b) => a - b);
      nextWeekNumber = scheduledWeeks.find(w => !playedWeeks.has(w)) ?? 0;
      if (nextWeekNumber > 0) {
        weekSchedule = allSchedule.filter(s => s.week === nextWeekNumber);
      }
      const latestWeekSchedule = allSchedule.find(s => s.week === seasonSnapshot.weekNumber);
      if (latestWeekSchedule?.matchDate) {
        latestWeekDate = formatMatchDate(latestWeekSchedule.matchDate, { month: 'long', day: 'numeric', year: 'numeric' });
      }
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <TrackVisibility section="ticker" page="home">
        <MilestoneTicker items={allTickerItems} variant="dark" />
      </TrackVisibility>

      {/* Hide the real layout footer on this test page */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <style dangerouslySetInnerHTML={{ __html: 'main + footer { display: none !important; }' }} />

      {/* V2: NO logo hero. Jump straight to content. */}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 space-y-5 sm:space-y-6 mt-3 sm:mt-4">

        {/* Results bar - same as current */}
        {seasonSnapshot && (
          <div className="relative rounded-xl overflow-hidden shadow-md ring-1 ring-navy/10">
            <ParallaxBg src="/village-lanes-chairs.jpg" imgW={2048} imgH={1536} focalY={0.5} mobileSrc="/village-lanes-lanes.jpg" mobileFocalY={0.6} mobileImgW={3024} mobileImgH={4032} />
            <div className="absolute inset-0 bg-black/60" />
            <Link
              href={`/week/${seasonSnapshot.slug}/${seasonSnapshot.weekNumber}`}
              className="relative flex flex-row md:hidden group hover:bg-white/5 transition-colors"
            >
              <div className="flex-1 flex items-center px-4 py-3">
                <div>
                  <div className="font-heading text-lg text-white group-hover:text-red-300 transition-colors">
                    Week {seasonSnapshot.weekNumber} Results
                  </div>
                  {latestWeekDate && <div className="font-body text-xs text-white/70 mt-0.5">{latestWeekDate}</div>}
                </div>
              </div>
              <div className="w-px bg-white/15 my-3" />
              <div className="px-4 py-2 flex items-center justify-center overflow-hidden">
                <InlineCountdown targetDate={nextBowlingNight} followingDate={followingBowlingNight} weekNumber={nextWeekNumber} />
              </div>
            </Link>
            <div className="relative hidden md:flex flex-row">
              <Link
                href={`/week/${seasonSnapshot.slug}/${seasonSnapshot.weekNumber}`}
                className="flex-1 flex items-center justify-between px-6 py-4 group hover:bg-white/5 transition-colors"
              >
                <div>
                  <div className="font-heading text-2xl text-white group-hover:text-red-300 transition-colors">
                    Week {seasonSnapshot.weekNumber} Results
                  </div>
                  {latestWeekDate && <div className="font-body text-sm text-white/70 mt-0.5">{latestWeekDate}</div>}
                </div>
                <svg className="w-5 h-5 text-white/40 group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
              <div className="w-px bg-white/15 my-3" />
              <div className="px-6 py-4 flex items-center justify-center overflow-hidden">
                <InlineCountdown targetDate={nextBowlingNight} followingDate={followingBowlingNight} weekNumber={nextWeekNumber} />
              </div>
            </div>
          </div>
        )}

        {/* Standings + Matchups */}
        <div className="md:grid md:grid-cols-5 md:gap-6 space-y-5 md:space-y-0">
          {seasonSnapshot && (
            <TrackVisibility section="standings" page="home" className="md:col-span-3">
              <MiniStandings standings={standings} seasonSlug={seasonSnapshot.slug} romanNumeral={seasonSnapshot.romanNumeral} />
            </TrackVisibility>
          )}
          {seasonSnapshot && weekSchedule.length > 0 && nextWeekNumber > 0 && (
            <TrackVisibility section="matchups" page="home" className="md:col-span-2">
              <ThisWeekMatchups matchups={weekSchedule} matchResults={[]} seasonSlug={seasonSnapshot.slug} weekNumber={nextWeekNumber} romanNumeral={seasonSnapshot.romanNumeral} />
            </TrackVisibility>
          )}
        </div>

        {latestPost?.type === 'recap' && seasonSnapshot ? (
          <>
            <div className="hidden md:block">
              <TrackVisibility section="recap-snapshot" page="home">
                <RecapSnapshotCard post={latestPost} snapshot={seasonSnapshot} />
              </TrackVisibility>
            </div>
            <div className="md:hidden">
              <TrackVisibility section="season-snapshot" page="home">
                <SeasonSnapshot snapshot={seasonSnapshot} />
              </TrackVisibility>
            </div>
          </>
        ) : (
          <div className="md:grid md:grid-cols-2 md:gap-6 space-y-5 md:space-y-0">
            {latestPost && (
              <div className="hidden md:block h-full">
                <TrackVisibility section="promoted-blog" page="home" className="h-full">
                  <PromotedBlogCard post={latestPost} />
                </TrackVisibility>
              </div>
            )}
            <TrackVisibility section="season-snapshot" page="home">
              <SeasonSnapshot snapshot={seasonSnapshot} />
            </TrackVisibility>
          </div>
        )}

        {instagramPosts.length > 0 && (
          <TrackVisibility section="instagram-feed" page="home">
            <InstagramStrip posts={instagramPosts} />
          </TrackVisibility>
        )}

      </div>

      {/* V2 Footer preview: links flanking logo in one bar */}
      <footer className="mt-2">
        <div className="bg-navy">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-3">
            {/* Desktop: links | logo | links */}
            <div className="hidden sm:flex items-center justify-center gap-6 sm:gap-8">
              {/* Left links */}
              <span className="flex items-center gap-2 text-sm font-body font-semibold tracking-wide uppercase text-cream/90 -mt-[36px]">
                <span className="text-red/80"><svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" /></svg></span>
                About
              </span>
              <span className="flex items-center gap-2 text-sm font-body font-semibold tracking-wide uppercase text-cream/90 -mt-[36px]">
                <span className="text-red/80"><svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" /></svg></span>
                Rules
              </span>

              {/* Center logo + subtitle */}
              <div className="flex flex-col items-center">
                <Image
                  src="/splitzkrieg logo.png"
                  alt="Splitzkrieg Bowling League"
                  width={280}
                  height={100}
                  className="h-20 sm:h-28 w-auto brightness-0 invert opacity-95"
                  unoptimized
                />
                <p className="font-body text-sm text-cream/50 tracking-wide -mt-1">
                  Durham, NC &middot; Since 2007
                </p>
                <div className="flex items-center gap-4 mt-1">
                  <a href="https://www.instagram.com/splitzkriegbowlingleague/" target="_blank" rel="noopener noreferrer" aria-label="Splitzkrieg on Instagram" className="text-cream/40 hover:text-red transition-colors">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" /></svg>
                  </a>
                  <a href="https://www.facebook.com/groups/27865497820" target="_blank" rel="noopener noreferrer" aria-label="Splitzkrieg on Facebook" className="text-cream/40 hover:text-red transition-colors">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" /></svg>
                  </a>
                </div>
              </div>

              {/* Right links */}
              <span className="flex items-center gap-2 text-sm font-body font-semibold tracking-wide uppercase text-cream/90 -mt-[36px]">
                <span className="text-red/80"><svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M3.75 3a.75.75 0 00-.75.75v.5c0 .414.336.75.75.75H4c6.075 0 11 4.925 11 11v.25c0 .414.336.75.75.75h.5a.75.75 0 00.75-.75V16C17 8.82 11.18 3 4 3h-.25z" /><path d="M3 8.75A.75.75 0 013.75 8H4a8 8 0 018 8v.25a.75.75 0 01-.75.75h-.5a.75.75 0 01-.75-.75V16a6 6 0 00-6-6h-.25A.75.75 0 013 9.25v-.5zM7 15a2 2 0 11-4 0 2 2 0 014 0z" /></svg></span>
                Extras
              </span>
              <span className="flex items-center gap-2 text-sm font-body font-semibold tracking-wide uppercase text-cream/90 -mt-[36px]">
                <span className="text-red/80"><svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10 5a3 3 0 11-6 0 3 3 0 016 0zm-9 8c0-2.2 1.8-4 4-4h2c2.2 0 4 1.8 4 4v1H1v-1zm14-4h-1.5a.75.75 0 000 1.5H15v1.5a.75.75 0 001.5 0V10.5H18a.75.75 0 000-1.5h-1.5V7.5a.75.75 0 00-1.5 0V9z" /></svg></span>
                How to Join
              </span>
            </div>

            {/* Mobile: logo on top, links below */}
            <div className="flex flex-col items-center gap-4 sm:hidden">
              <div className="flex flex-col items-center">
                <Image
                  src="/splitzkrieg logo.png"
                  alt="Splitzkrieg Bowling League"
                  width={280}
                  height={100}
                  className="h-20 w-auto brightness-0 invert opacity-95"
                  unoptimized
                />
                <p className="font-body text-sm text-cream/50 tracking-wide -mt-1">
                  Durham, NC &middot; Since 2007
                </p>
                <div className="flex items-center gap-4 mt-1">
                  <a href="https://www.instagram.com/splitzkriegbowlingleague/" target="_blank" rel="noopener noreferrer" aria-label="Splitzkrieg on Instagram" className="text-cream/40 hover:text-red transition-colors">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" /></svg>
                  </a>
                  <a href="https://www.facebook.com/groups/27865497820" target="_blank" rel="noopener noreferrer" aria-label="Splitzkrieg on Facebook" className="text-cream/40 hover:text-red transition-colors">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" /></svg>
                  </a>
                </div>
              </div>
              <nav className="flex flex-row flex-wrap items-center justify-center gap-x-5 gap-y-3">
                <span className="flex items-center gap-2 text-sm font-body font-semibold tracking-wide uppercase text-cream/90">
                  <span className="text-red/80"><svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" /></svg></span>
                  About
                </span>
                <span className="flex items-center gap-2 text-sm font-body font-semibold tracking-wide uppercase text-cream/90">
                  <span className="text-red/80"><svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" /></svg></span>
                  Rules
                </span>
                <span className="flex items-center gap-2 text-sm font-body font-semibold tracking-wide uppercase text-cream/90">
                  <span className="text-red/80"><svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M3.75 3a.75.75 0 00-.75.75v.5c0 .414.336.75.75.75H4c6.075 0 11 4.925 11 11v.25c0 .414.336.75.75.75h.5a.75.75 0 00.75-.75V16C17 8.82 11.18 3 4 3h-.25z" /><path d="M3 8.75A.75.75 0 013.75 8H4a8 8 0 018 8v.25a.75.75 0 01-.75.75h-.5a.75.75 0 01-.75-.75V16a6 6 0 00-6-6h-.25A.75.75 0 013 9.25v-.5zM7 15a2 2 0 11-4 0 2 2 0 014 0z" /></svg></span>
                  Extras
                </span>
                <span className="flex items-center gap-2 text-sm font-body font-semibold tracking-wide uppercase text-cream/90">
                  <span className="text-red/80"><svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10 5a3 3 0 11-6 0 3 3 0 016 0zm-9 8c0-2.2 1.8-4 4-4h2c2.2 0 4 1.8 4 4v1H1v-1zm14-4h-1.5a.75.75 0 000 1.5H15v1.5a.75.75 0 001.5 0V10.5H18a.75.75 0 000-1.5h-1.5V7.5a.75.75 0 00-1.5 0V9z" /></svg></span>
                  How to Join
                </span>
              </nav>
            </div>

          </div>
        </div>
      </footer>
    </div>
  );
}
