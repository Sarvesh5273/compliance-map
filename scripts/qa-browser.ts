import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const errors:string[]=[];
page.on('pageerror',error=>errors.push(error.message));
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});
await page.screenshot({path:'artifacts/home-desktop.png',fullPage:true});
console.log(JSON.stringify({phase:'home',title:await page.title(),headings:await page.locator('h1').allTextContents(),horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),errors}));
if(process.argv.includes('--examples')){
 for(const id of ['cafe','company']){
  await page.goto(`http://127.0.0.1:5173/?example=${id}`,{waitUntil:'networkidle'});
  const button=page.getByRole('button',{name:id==='cafe'?/café/i:/company/i}).first();
  if(await button.count())await button.click();
  await page.waitForTimeout(1400);
  await page.screenshot({path:`artifacts/${id}-desktop.png`,fullPage:true});
  console.log(JSON.stringify({phase:id,body:(await page.locator('body').innerText()).slice(-1800),errors}));
 }
}
await page.setViewportSize({width:390,height:844});
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});
await page.screenshot({path:'artifacts/home-mobile.png',fullPage:true});
console.log(JSON.stringify({phase:'mobile',horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),errors}));
await browser.close();
if(errors.length)process.exitCode=1;
