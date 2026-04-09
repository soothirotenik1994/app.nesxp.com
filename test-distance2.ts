import axios from 'axios';

async function test() {
  try {
    const response = await axios.post('http://localhost:3000/api/calculate-distance', {
      originUrl: 'https://maps.app.goo.gl/EKrN2H3rxkh',
      destinationUrl: 'https://maps.app.goo.gl/3Abm6KUJSC'
    });
    console.log(response.data);
  } catch (e: any) {
    console.error(e.response?.data || e.message);
  }
}

test();
