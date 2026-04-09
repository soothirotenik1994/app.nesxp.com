import axios from 'axios';
import fs from 'fs';

async function test() {
  try {
    const response = await axios.get('https://maps.app.goo.gl/9uiMcYSaE5LSfxJt5', {
      maxRedirects: 0,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      }
    });
    fs.writeFileSync('dynamic-link.html', response.data);
    console.log('Saved to dynamic-link.html');
  } catch (e: any) {
    console.error(e.message);
  }
}

test();
