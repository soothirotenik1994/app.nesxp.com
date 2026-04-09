import axios from 'axios';

async function test() {
  try {
    const response = await axios.post('http://localhost:3000/api/calculate-distance', {
      originUrl: 'https://maps.app.goo.gl/XfVvfeXu5SHrxtnf8',
      destinationUrl: 'https://maps.app.goo.gl/9uiMcYSaE5LSfxJt5'
    });
    console.log(response.data);
  } catch (e) {
    console.error(e.response?.data || e.message);
  }
}

test();
