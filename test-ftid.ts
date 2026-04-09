import axios from 'axios';

async function test() {
  try {
    const response = await axios.get('https://www.google.com/maps/place/data=!3m1!4b1!4m6!3m5!1s0x311d5ff1cac74209:0x6a7568aa17119730', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    const html = response.data;
    const matches = html.match(/-?\d+\.\d{4,}/g);
    if (matches) {
      const unique = [...new Set(matches)];
      console.log(unique.slice(0, 20));
    }
  } catch (e: any) {
    console.error(e.message);
  }
}

test();
