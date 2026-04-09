import axios from 'axios';

async function test() {
  try {
    const response = await axios.get('https://maps.app.goo.gl/9uiMcYSaE5LSfxJt5', {
      maxRedirects: 10,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    const html = response.data;
    const ogImageMatch = html.match(/<meta\s+(?:property|name)="og:image"\s+content="(.*?)"/i);
    if (ogImageMatch) {
      console.log('og:image:', ogImageMatch[1]);
    } else {
      console.log('No og:image found');
    }
    
    // Look for center=lat,lng
    const centerMatch = html.match(/center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/);
    if (centerMatch) {
      console.log('center:', centerMatch[1], centerMatch[2]);
    }
  } catch (e: any) {
    console.error(e.message);
  }
}

test();
