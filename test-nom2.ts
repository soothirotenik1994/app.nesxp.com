import axios from 'axios';

async function test() {
  const urls = [
    'https://maps.app.goo.gl/XfVvfeXu5SHrxtnf8',
    'https://maps.app.goo.gl/9uiMcYSaE5LSfxJt5',
    'https://maps.app.goo.gl/MrpfCZpLAkK7zZ1B9',
    'https://maps.app.goo.gl/zZPRZRCfvjtjTS277',
    'https://maps.app.goo.gl/bprVGTPw1gJPkHjk6'
  ];

  for (const url of urls) {
    try {
      const response = await axios.get(url, {
        maxRedirects: 10,
        validateStatus: () => true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });
      const finalUrl = response.request.res.responseUrl;
      console.log('Final URL:', finalUrl);
      
      const urlObj = new URL(finalUrl);
      const q = urlObj.searchParams.get('q');
      if (q) {
        console.log('q:', q);
        // Try to search with Nominatim
        const nomRes = await axios.get(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`, {
          headers: { 'User-Agent': 'AI-Studio-Applet/1.0' }
        });
        if (nomRes.data.length > 0) {
          console.log('Nominatim:', nomRes.data[0].lat, nomRes.data[0].lon);
        } else {
          console.log('Nominatim: Not found');
        }
      }
    } catch (e: any) {
      console.error(e.message);
    }
  }
}

test();
