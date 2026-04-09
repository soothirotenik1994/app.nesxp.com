import fs from 'fs';

const html = fs.readFileSync('map.html', 'utf-8');
const matches = html.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/g);
if (matches) {
  const unique = [...new Set(matches)];
  console.log(unique.slice(0, 20));
} else {
  console.log('No matches');
}
