import axios from 'axios';

async function test() {
  try {
    const response = await axios.get('https://www.google.com/maps?q=Takachiho+Fire,+Security+%26+Services+(Thailand)+Ltd.,+1858/110-111,+Interlink+Tower+25th+Fl+Thanon+Debaratana+Bang+Na+Tai+%E0%B9%80%E0%B8%82%E0%B8%95%E0%B8%9A%E0%B8%B2%E0%B8%87%E0%B8%99%E0%B8%B2+%E0%B8%81%E0%B8%A3%E0%B8%B8%E0%B8%87%E0%B9%80%E0%B8%97%E0%B8%9E%E0%B8%A1%E0%B8%AB%E0%B8%B2%E0%B8%99%E0%B8%84%E0%B8%A3+10260&ftid=0x311d5ff1cac74209:0x6a7568aa17119730&entry=gps', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
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
