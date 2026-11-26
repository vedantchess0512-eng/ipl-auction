import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 800 });
await mkdir('screenshots', { recursive: true });

// Landing
await page.goto('http://localhost:5173');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/01_landing.png', fullPage: true });

// Host Setup
await page.goto('http://localhost:5173/host');
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/02_host.png', fullPage: true });

await browser.close();
console.log('Screenshots done!');
