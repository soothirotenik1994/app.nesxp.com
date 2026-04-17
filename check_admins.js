import axios from 'axios';

async function checkAdmins() {
  const url = 'https://data.nesxp.com/users';
  const token = 'r0eWclUwYkWhUWVlaYkzgOJzAKpRtEex';
  
  try {
    const response = await axios.get(url, {
      params: {
        filter: {
          email: { _eq: 'soothirote.nik@gmail.com' }
        }
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Admin check Results:', JSON.stringify(response.data.data, null, 2));
  } catch (err) {
    console.error('Error:', err.response?.status, err.response?.data || err.message);
  }
}

checkAdmins();
