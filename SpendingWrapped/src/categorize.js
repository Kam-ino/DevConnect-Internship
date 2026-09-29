const RULES = [
  ['Food delivery', ['grabfood', 'foodpanda', 'food panda']],
  ['Coffee', ['starbucks', 'coffee', 'cafe', 'café', 'tim hortons', 'kopi', 'dunkin', 'bo\'s']],
  ['Food & drinks', ['jollibee', 'mcdonald', 'chowking', 'mang inasal', 'kfc', 'greenwich', 'restaurant', 'bakery', 'carinderia', 'eatery', 'pizza', 'burger', 'milk tea']],
  ['Transport', ['grab', 'angkas', 'joyride', 'beep', 'lrt', 'mrt', 'taxi', 'shell', 'petron', 'caltex', 'seaoil', 'toll', 'autosweep', 'easytrip']],
  ['Groceries', ['supermarket', 'puregold', 'robinsons', 'savemore', 'waltermart', '7-eleven', '7 eleven', 'ministop', 'alfamart', 'grocery', 'market']],
  ['Shopping', ['shopee', 'lazada', 'zalora', 'uniqlo', 'h&m', 'sm store', 'ikea', 'amazon']],
  ['Bills & utilities', ['meralco', 'maynilad', 'manila water', 'globe', 'smart', 'pldt', 'converge', 'sky fiber', 'dito']],
  ['Subscriptions', ['netflix', 'spotify', 'youtube', 'disney', 'apple.com', 'icloud', 'google one', 'chatgpt', 'viu']],
  ['Health', ['mercury drug', 'watsons', 'southstar', 'pharmacy', 'hospital', 'clinic', 'dental']],
  ['Entertainment', ['cinema', 'steam', 'playstation', 'nintendo', 'timezone', 'concert']],
];

export const CATEGORIES = [...RULES.map(([name]) => name), 'Other'];

export function categorize(merchant, given) {
  const provided = typeof given === 'string' ? given.trim() : '';
  if (provided) return provided.slice(0, 40);
  const name = merchant.toLowerCase();
  for (const [category, keywords] of RULES) {
    if (keywords.some((k) => name.includes(k))) return category;
  }
  return 'Other';
}
