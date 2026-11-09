/**
 * An endless parade across the bottom of the close card, for the Parade line
 * above it: bowling pins with a float every few pins. Pure CSS: the row is drawn twice and slid by
 * half its width on a loop, so it never runs out. Still for reduced motion.
 */
function Pin({ delay }: { delay: number }) {
  return (
    <svg
      viewBox="-2 -3 44 106"
      className="h-12 w-auto flex-none motion-safe:[animation:pin-waddle_0.9s_ease-in-out_infinite_alternate]"
      style={{ animationDelay: `${delay}s` }}
      aria-hidden
    >
      <path
        d="M20 2c-6 0-9 5-9 11 0 7 4 10 4 18 0 9-11 16-11 36 0 15 7 31 16 31s16-16 16-31c0-20-11-27-11-36 0-8 4-11 4-18 0-6-3-11-9-11z"
        fill="#FFFBF2" stroke="#1B2A4A" strokeWidth="3"
      />
      <path d="M12.5 44h15M11.5 52h17" stroke="#C53030" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** A parade float between the pins: an emoji at pin height, bobbing on its own beat. */
function Float({ glyph, delay }: { glyph: string; delay: number }) {
  return (
    <span
      className="inline-block flex-none text-[2.6rem] leading-none self-end motion-safe:[animation:pin-waddle_1.1s_ease-in-out_infinite_alternate]"
      style={{ animationDelay: `${delay}s` }}
    >
      {glyph}
    </span>
  );
}

/** The lineup, repeated: four pins, then a float. Pickup truck, Santa, the turkey, the marching band, the parade balloon. */
const FLOATS = ['\u{1F6FB}', '\u{1F385}', '\u{1F983}', '\u{1F3BA}', '\u{1F388}'];

export function PinParade() {
  const lineup: Array<{ kind: 'pin' } | { kind: 'float'; glyph: string }> = [];
  FLOATS.forEach(glyph => {
    for (let i = 0; i < 4; i++) lineup.push({ kind: 'pin' });
    lineup.push({ kind: 'float', glyph });
  });
  return (
    <div className="mt-10 -mx-6 sm:-mx-10 overflow-hidden py-2" aria-hidden>
      <div className="flex w-max motion-safe:[animation:pin-march_40s_linear_infinite]">
        {[0, 1].map(copy => (
          <div key={copy} className="flex items-end gap-5 pr-5">
            {lineup.map((item, i) => item.kind === 'pin'
              ? <Pin key={i} delay={(i % 5) * 0.18} />
              : <Float key={i} glyph={item.glyph} delay={(i % 3) * 0.25} />)}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes pin-march { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes pin-waddle { from { transform: rotate(-4deg) translateY(0); } to { transform: rotate(4deg) translateY(-2px); } }
      `}</style>
    </div>
  );
}
