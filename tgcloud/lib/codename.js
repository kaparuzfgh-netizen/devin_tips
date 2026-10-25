// Release codenames: deterministic word-prefix names derived from a date.
// Pure module — no 'sdk', no Date.now/Math.random: same input, same name.

// Word pool for codenames: fun words from everywhere — gems, elements,
// Latin, cats, plants, space, food, transport, weather, tools, music.
export const WORDS = [
  // gems & stones
  'agate', 'onyx', 'jade', 'opal', 'garnet', 'topaz', 'amber', 'beryl',
  'quartz', 'ruby', 'pearl', 'coral', 'ivory', 'basalt', 'flint', 'slate',
  'marble', 'zircon', 'jasper', 'citrine', 'amethyst', 'obsidian', 'hematite',
  'malachite',
  // chemical elements
  'neon', 'argon', 'boron', 'xenon', 'cobalt', 'nickel', 'copper', 'silver',
  'iron', 'zinc', 'lead', 'gold', 'radon', 'helium', 'carbon', 'oxygen',
  'silicon', 'sodium', 'lithium', 'barium', 'cesium', 'indium', 'iridium',
  'krypton', 'mercury', 'titanium', 'uranium', 'tungsten', 'gallium',
  // latin
  'luna', 'aqua', 'ignis', 'noctis', 'felis', 'ventus', 'terra', 'solis',
  'stella', 'mare', 'silva', 'aurum', 'ferrum', 'veritas', 'vita', 'flos',
  'folium', 'umbra', 'aurora', 'tempus', 'nubes', 'pluvia', 'gelu', 'aestas',
  'hiems', 'arbor', 'herba', 'campus', 'mons', 'collis', 'rivus', 'unda',
  'glacies', 'cinis', 'scintilla', 'sidus', 'aether', 'aura', 'ordo',
  'sonus', 'cantus', 'saltus',
  // cats & vibe
  'felix', 'purr', 'whisker', 'tabby', 'kitten', 'meow', 'claw', 'yarn',
  'groove', 'chill', 'lofi', 'vibe', 'cozy', 'paws', 'snooze', 'cuddle',
  'pounce', 'mews', 'kitty', 'scratch', 'fluff', 'muffin', 'biscuit',
  'velvet', 'midnight', 'shadow', 'ginger', 'marmalade', 'smoke', 'socks',
  'tuxedo', 'calico',
  // plants
  'maple', 'birch', 'willow', 'cedar', 'pine', 'aspen', 'alder', 'rowan',
  'hazel', 'holly', 'sage', 'thyme', 'basil', 'mint', 'clover', 'fern',
  'moss', 'reed', 'lotus', 'iris', 'lily', 'daisy', 'poppy', 'tulip',
  'orchid', 'bamboo', 'cactus', 'aloe', 'ficus', 'dahlia', 'violet',
  'heather', 'juniper', 'sequoia', 'magnolia',
  // space
  'comet', 'orbit', 'nova', 'quasar', 'pulsar', 'nebula', 'galaxy', 'meteor',
  'asteroid', 'cosmo', 'astral', 'eclipse', 'zenith', 'apogee', 'perigee',
  'satellite', 'rocket', 'shuttle', 'mars', 'venus', 'pluto', 'titan',
  'europa', 'ganymede', 'callisto', 'rhea', 'oberon', 'miranda', 'ariel',
  'umbriel', 'titania',
  // food
  'mango', 'kiwi', 'melon', 'peach', 'plum', 'apple', 'berry', 'cherry',
  'grape', 'lemon', 'lime', 'date', 'olive', 'cocoa', 'honey', 'sugar',
  'spice', 'mocha', 'latte', 'cacao', 'waffle', 'croissant', 'bagel',
  'noodle', 'ramen', 'sushi', 'taco', 'pizza', 'pasta', 'pesto', 'salsa',
  'caramel', 'vanilla', 'cinnamon', 'pepper', 'saffron', 'sesame', 'wasabi',
  'tofu',
  // transport & travel
  'wagon', 'train', 'metro', 'tram', 'ferry', 'yacht', 'canoe', 'kayak',
  'glider', 'zeppelin', 'balloon', 'scooter', 'bicycle', 'tandem', 'sled',
  'cruise', 'voyage', 'turbo', 'diesel',
  // weather
  'breeze', 'storm', 'cloud', 'rain', 'snow', 'frost', 'sleet', 'hail',
  'mist', 'drizzle', 'shower', 'thunder', 'lightning', 'cyclone', 'monsoon',
  'tempest', 'gale', 'squall', 'zephyr', 'mistral', 'sirocco',
  // tools & things
  'wrench', 'hammer', 'anvil', 'chisel', 'mallet', 'trowel', 'level',
  'plumb', 'lathe', 'drill', 'solder', 'lever', 'pivot', 'hinge', 'pulley',
  'gear', 'spring', 'magnet', 'prism', 'lens', 'mirror', 'beacon',
  'lantern', 'candle', 'torch',
  // music
  'tempo', 'rhythm', 'melody', 'harmony', 'chord', 'octave', 'sonata',
  'ballad', 'rondo', 'fugue', 'waltz', 'tango', 'samba', 'mambo', 'rumba',
  'polka', 'disco', 'jazz', 'blues', 'swing', 'bebop', 'reggae', 'folk',
  'synth', 'vinyl', 'banjo', 'cello', 'viola', 'flute', 'oboe', 'harp',
  'lute', 'drum', 'bass', 'trombone', 'trumpet', 'bugle', 'marimba',
  'ukulele', 'bongo', 'tabla', 'sitar', 'kazoo',
  // misc fun
  'doodle', 'puzzle', 'riddle', 'jigsaw', 'mosaic', 'origami', 'pixel',
  'voxel', 'emoji', 'widget', 'gadget', 'gizmo', 'bubble', 'pebble',
  'ripple', 'zigzag', 'wander', 'roam', 'quest', 'trek', 'glide', 'float',
  'bounce', 'twirl', 'swirl', 'fizzle', 'sparkle', 'twinkle', 'glimmer',
  'shimmer', 'blaze', 'ember', 'spark', 'flare', 'glow', 'halo', 'echo',
];

const DAY_MS = 24 * 3600 * 1000;

// FNV-1a 32-bit — stable hash that seeds the word picker.
export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32 — small deterministic PRNG seeded by the FNV hash.
function rng(seed) {
  let state = hash(seed) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Picks lengths.length distinct words by seed and glues their prefixes of the
// given lengths: banana+house+airplane with [3,2,3] -> "banhoair".
// All WORDS are >= 4 chars and every prefix is <= 3, so a word always covers
// its prefix.
export function pickName(seed, lengths) {
  const rand = rng(seed);
  const used = new Set();
  let out = '';
  for (const len of lengths) {
    let idx;
    do {
      idx = Math.floor(rand() * WORDS.length);
    } while (used.has(idx));
    used.add(idx);
    out += WORDS[idx].slice(0, len);
  }
  return out;
}

export function dayName(dateStr) {
  return pickName(`D:${dateStr}`, [3, 2, 3]);
}

// ISO-8601 week key: the week belongs to the year of its Thursday; Monday is
// day one. UTC arithmetic only — no local timezone.
function isoWeekKey(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const isoDow = ((date.getUTCDay() + 6) % 7) + 1; // Monday=1 ... Sunday=7
  const thursday = new Date(date.getTime() + (4 - isoDow) * DAY_MS);
  const isoYear = thursday.getUTCFullYear();
  const isoWeek = Math.floor((thursday.getTime() - Date.UTC(isoYear, 0, 1)) / (7 * DAY_MS)) + 1;
  return { isoYear, isoWeek };
}

export function weekName(dateStr) {
  const { isoYear, isoWeek } = isoWeekKey(dateStr);
  const name = pickName(`W:${isoYear}-W${isoWeek}`, [3, 3, 2, 3]);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function monthName(dateStr) {
  const [y, m] = dateStr.split('-');
  return pickName(`M:${y}-${m}`, [3, 2, 3, 2, 3]).toUpperCase();
}

export function releaseNames(dateStr) {
  return { day: dayName(dateStr), week: weekName(dateStr), month: monthName(dateStr) };
}

// UTC date of `now + 8h`: the day boundary is 16:00 UTC, so at 16:00Z the
// label already moves to the next calendar day.
export function currentLabelDate(now = new Date()) {
  return new Date(now.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
