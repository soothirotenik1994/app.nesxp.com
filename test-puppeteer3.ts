import puppeteer from 'puppeteer';

async function test() {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const start = Date.now();
  try {
    const page = await browser.newPage();
    // Block images and css to speed up
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.resourceType() === 'image' || req.resourceType() === 'stylesheet' || req.resourceType() === 'font') {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto('https://maps.app.goo.gl/9uiMcYSaE5LSfxJt5', { waitUntil: 'domcontentloaded' });
    
    // Wait until URL has @lat,lng
    await page.waitForFunction(() => window.location.href.includes('@'), { timeout: 10000 });
    
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
    console.log('Time:', Date.now() - start, 'ms');
  }
}

test();
