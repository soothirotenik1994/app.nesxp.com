import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pocketbase.nesxp.com');

async function test() {
  try {
    await pb.admins.authWithPassword('admin@nesxp.com', 'asd024865');
    
    const formData = new FormData();
    const blob = new Blob(['12345'], { type: 'text/plain' });
    formData.append('field', blob, 'test.txt');
    formData.append('title', 'test.txt');
    
    const record = await pb.collection('images').create(formData);
    console.log('Success:', record);
  } catch (error: any) {
    console.error('Error:', error.response || error);
  }
}
test();
