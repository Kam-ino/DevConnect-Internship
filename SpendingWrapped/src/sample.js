function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COFFEE = ['Starbucks BGC', 'Tim Hortons Eastwood', 'Kopi Roti Marikina', "Bo's Coffee"];
const LUNCH = ['Jollibee Marikina', 'Chowking', 'Mang Inasal', 'Carinderia ni Aling Nena', 'KFC SM Marikina', 'Greenwich'];
const RIDES = ['Grab', 'Grab', 'Angkas', 'Beep Card LRT-2', 'Joyride'];
const GROCERY = ['SM Supermarket Marikina', 'Puregold', 'Robinsons Supermarket', '7-Eleven'];
const SHOPPING = ['Shopee', 'Lazada', 'Uniqlo SM Megamall', 'Zalora'];
const DELIVERY = ['GrabFood', 'foodpanda'];
const MONTHLY = [
  ['Meralco', 180000, 320000, 12],
  ['Maynilad', 35000, 60000, 14],
  ['Globe Postpaid', 99900, 99900, 5],
  ['Converge FiberX', 150000, 150000, 20],
  ['Netflix', 54900, 54900, 3],
  ['Spotify Premium', 19400, 19400, 9],
];

export function generateSampleCsv({ year = 2025, seed = 2025 } = {}) {
  const rand = mulberry32(seed);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const amount = (min, max) => (Math.round((min + rand() * (max - min)) / 25) * 25) / 100;
  const lines = [];
  const add = (date, merchant, value, category = '') => lines.push({ date, merchant, value, category });

  for (let d = new Date(Date.UTC(year, 0, 1)); d.getUTCFullYear() === year; d.setUTCDate(d.getUTCDate() + 1)) {
    const date = d.toISOString().slice(0, 10);
    const weekday = d.getUTCDay();
    const workday = weekday >= 1 && weekday <= 5;
    const december = d.getUTCMonth() === 11;
    if (workday && rand() < 0.62) add(date, pick(COFFEE), amount(14000, 26000));
    if (rand() < (workday ? 0.95 : 0.5)) add(date, pick(RIDES), amount(6000, 32000));
    if (workday && rand() < 0.4) add(date, pick(RIDES), amount(6000, 28000));
    if (rand() < 0.75) add(date, pick(LUNCH), amount(12000, 38000));
    if (weekday === 6) add(date, pick(GROCERY.slice(0, 3)), amount(180000, 420000));
    if (rand() < 0.12) add(date, '7-Eleven', amount(4000, 18000));
    if (rand() < (december ? 0.45 : 0.1)) add(date, pick(SHOPPING), amount(30000, december ? 480000 : 250000));
    if (rand() < (weekday === 5 || weekday === 6 ? 0.35 : 0.08)) add(date, pick(DELIVERY), amount(25000, 90000));
    if (rand() < 0.03) add(date, 'Mercury Drug', amount(15000, 90000));
    if (rand() < 0.025) add(date, 'SM Cinema', amount(35000, 70000));
    for (const [merchant, min, max, day] of MONTHLY) {
      if (d.getUTCDate() === day) add(date, merchant, amount(min, max));
    }
  }

  lines.splice(40, 0, { date: `${year}-02-30`, merchant: 'Jollibee Marikina', value: 189 });
  lines.splice(300, 0, { date: `${year}-05-17`, merchant: 'Shopee', value: -899, category: '' });
  lines.splice(610, 0, { date: `${year}-08-02`, merchant: 'Grab', value: 'TBA' });
  lines.splice(900, 0, { date: `${year}-10-11`, merchant: '', value: 250 });

  const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const body = lines.map((l) => [l.date, esc(l.merchant), typeof l.value === 'number' ? l.value.toFixed(2) : l.value, esc(l.category)].join(','));
  return ['date,merchant,amount,category', ...body].join('\n') + '\n';
}
