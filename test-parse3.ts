import fs from 'fs';

const html = fs.readFileSync('map.html', 'utf-8');
console.log('Size:', html.length);
console.log('Title:', html.match(/<title>(.*?)<\/title>/)?.[1]);
