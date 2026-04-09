import fs from 'fs';

const html = fs.readFileSync('map.html', 'utf-8');
const matches = html.match(/13\.\d{4,},100\.\d{4,}/g);
if (matches) {
  const unique = [...new Set(matches)];
  console.log(unique.slice(0, 20));
} else {
  console.log('No matches');
}

const matches2 = html.match(/100\.\d{4,},13\.\d{4,}/g);
if (matches2) {
  const unique = [...new Set(matches2)];
  console.log(unique.slice(0, 20));
} else {
  console.log('No matches2');
}
