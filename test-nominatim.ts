import axios from 'axios';

async function test() {
  try {
    const q = 'Takachiho Fire, Security & Services (Thailand) Ltd.';
    const response = await axios.get(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`, {
      headers: {
        'User-Agent': 'AI-Studio-Applet/1.0'
      }
    });
    console.log('Nominatim result:', response.data);
  } catch (e: any) {
    console.error(e.message);
  }
}

test();
