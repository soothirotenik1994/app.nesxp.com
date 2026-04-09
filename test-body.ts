import axios from 'axios';

async function test() {
  try {
    const response = await axios.get('https://maps.app.goo.gl/9uiMcYSaE5LSfxJt5', {
      maxRedirects: 0,
      validateStatus: () => true,
    });
    console.log('Body:', response.data);
  } catch (e: any) {
    console.error(e.message);
  }
}

test();
