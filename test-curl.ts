import axios from 'axios';

async function test() {
  try {
    const response = await axios.get('https://maps.app.goo.gl/EKrN2H3rxkh', {
      maxRedirects: 10,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
      }
    });
    console.log('Final URL 1:', response.request.res.responseUrl);

    const response2 = await axios.get('https://maps.app.goo.gl/3Abm6KUJSC', {
      maxRedirects: 10,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
      }
    });
    console.log('Final URL 2:', response2.request.res.responseUrl);
  } catch (e: any) {
    console.error(e.message);
  }
}

test();
