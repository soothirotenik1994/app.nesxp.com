import puppeteer from 'puppeteer';

async function test() {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://maps.app.goo.gl/9uiMcYSaE5LSfxJt5');
    await new Promise(r => setTimeout(r, 5000)); // wait 5 seconds
    const url = page.url();
    console.log('Final URL:', url);
    
    const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) {
      console.log('Coords:', match[1], match[2]);
    } else {
      console.log('No coords in URL');
    }
  } catch (e: any) {
    console.error(e.message);
  } finally {
    await browser.close();
  }
}

test();
