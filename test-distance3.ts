import axios from 'axios';

async function test() {
  try {
    const response = await axios.post('http://localhost:3000/api/calculate-distance', {
      originUrl: 'https://www.google.com/maps/place/13.7563,100.5018',
      destinationUrl: 'https://www.google.com/maps/place/13.7564,100.5019'
    });
    console.log(response.data);
  } catch (e: any) {
    console.error(e.response?.data || e.message);
  }
}

test();
