import axios from 'axios';

async function test() {
  try {
    const response = await axios.get('https://maps.app.goo.gl/9uiMcYSaE5LSfxJt5', {
      maxRedirects: 0,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      }
    });
    const html = response.data;
    const match = html.match(/<link rel="canonical" href="(.*?)">/);
    console.log('Canonical:', match ? match[1] : 'Not found');
    
    // Look for other URLs in the HTML
    const urls = html.match(/https:\/\/maps\.google\.com[^\s"']+/g);
    if (urls) {
      console.log('URLs:', urls);
    }
    
    const allUrls = html.match(/https:\/\/[^\s"']+/g);
    console.log('All URLs:', allUrls?.filter(u => u.includes('google.com') || u.includes('goo.gl')));
  } catch (e: any) {
    console.error(e.message);
  }
}

test();
