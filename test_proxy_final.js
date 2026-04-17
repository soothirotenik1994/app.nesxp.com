import axios from 'axios';

async function testProxyLogin() {
  const url = 'http://localhost:3000/api/directus/items/line_users';
  
  try {
    const response = await axios.get(url, {
      params: {
        filter: {
          _and: [
            { password: { _eq: 'asd024865' } },
            {
              _or: [
                { email: { _eq: 'soothirote.nik@gmail.com' } },
                { phone: { _eq: 'soothirote.nik@gmail.com' } },
                { line_user_id: { _eq: 'soothirote.nik@gmail.com' } },
                { display_name: { _eq: 'soothirote.nik@gmail.com' } }
              ]
            }
          ]
        }
      }
    });
    
    console.log('Proxy Results:', JSON.stringify(response.data.data, null, 2));
  } catch (err) {
    console.error('Proxy Error:', err.response?.status, err.response?.data || err.message);
  }
}

testProxyLogin();
