import fs from 'fs';

const html = fs.readFileSync('map.html', 'utf-8');
const matches = html.match(/-?\d+\.\d{4,}/g);
if (matches) {
  const unique = [...new Set(matches)];
  console.log(unique.slice(0, 50));
} else {
  console.log('No matches');
}
