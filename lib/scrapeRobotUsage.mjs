// lib/scrapeRobotUsage.mjs

import puppeteer from 'puppeteer';
import { formatRFC3339, subDays } from 'date-fns';
import fs from 'fs/promises';
import path from 'path';

//const dataFilePath = path.join(process.cwd(), 'public/robot-usage-cache.json');
const dataFilePath = '/usr/share/nginx/html/robot-usage-cache.json'; // path.join(process.cwd(), 'public/robot-usage-cache.json');

// --- Configuration ---
const loginUrl = process.env.SCRAPER_LOGIN_URL || 'https://cosco.robots.pluginbot.ai/login';
const successUrl = process.env.SCRAPER_SUCCESS_URL || 'https://cosco.robots.pluginbot.ai/';
const reportsBaseUrl = process.env.SCRAPER_REPORTS_URL || 'https://cosco.robots.pluginbot.ai/reports/operations';
const myEmail = process.env.SCRAPER_EMAIL;
const myPassword = process.env.SCRAPER_PASSWORD;

// --- Selectors ---
const emailSelector = 'input[type="text"]';
const passwordSelector = 'input[type="password"]';
const signInButtonSelector = 'button[type="submit"]';
// ▼▼▼ NEW SELECTOR to confirm the login page is fully rendered ▼▼▼
const loginPageReadySelector = "xpath///span[contains(text(), 'Forgot your password?')]";
const robotUsageTimeValueSelector = "xpath///span[contains(text(), 'Robot Usage Time')]/ancestor::div[contains(@class, 'jr-card')]//p[@class='value']";


// --- Helper Functions --- (No changes here)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function generateReportUrl(start, end) {
    const timeZone = 'Europe/Athens';
    const now = end || new Date();
    const fromDate = start || subDays(now, 7);
    // const formatString = "yyyy-MM-dd'T'HH:mm:ssXXX";
    const untilParam = formatRFC3339(now);
    const fromParam = formatRFC3339(fromDate);
    const url = new URL(reportsBaseUrl);
    url.hash = `from=${encodeURIComponent(fromParam)}&until=${encodeURIComponent(untilParam)}`;
    // url.hash = `from=${encodeURIComponent('2025-07-22T14:48:52Z')}&until=${encodeURIComponent('2025-08-21T14:48:52Z')}`;
    console.log('report URL==>', url.toString());
    return url.toString();
}
function convertTimeToSeconds(timeString) {
    if (!timeString || !/^\d{2}:\d{2}:\d{2}$/.test(timeString)) {
        console.error(`Invalid time format: "${timeString}". Expected "HH:MM:SS".`);
        return 0;
    }
    const [hours, minutes, seconds] = timeString.split(':').map(Number);
    return (hours * 3600) + (minutes * 60) + seconds;
}


// --- Main Scraper Function ---
export async function scrapeAndStoreUsageTime(start, end) {
  if (!myEmail || !myPassword) {
    console.error("[SCRAPER] Error: Scraper credentials are not set.");
    return;
  }

  let browser;
  console.log('[SCRAPER] Starting background job...');

  try {
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    console.log('[SCRAPER] Navigating to login page...');
    await page.goto(loginUrl, { waitUntil: 'networkidle2' });

    // --- ▼▼▼ NEW: ROBUST LOGIN PAGE LOADING WITH RETRIES ▼▼▼ ---
    const maxRetries = 3;
    let loginPageLoaded = false;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`[SCRAPER] Attempt ${attempt}/${maxRetries}: Waiting for login page to be ready...`);
        try {
            await page.waitForSelector(loginPageReadySelector, { timeout: 10000 });
            console.log('[SCRAPER] ✅ Login page is ready.');
            loginPageLoaded = true;
            break; // Success, exit the loop
        } catch (error) {
            console.warn(`[SCRAPER] ⚠️ Login page did not load in 10 seconds (Attempt ${attempt}).`);
            if (attempt < maxRetries) {
                console.log('[SCRAPER] Refreshing page and retrying...');
                await page.reload({ waitUntil: 'networkidle2' });
            }
        }
    }

    if (!loginPageLoaded) {
        throw new Error(`Failed to load the login page content after ${maxRetries} attempts.`);
    }
    // --- ▲▲▲ END OF RETRY LOGIC ▲▲▲ ---

    // Now we can safely interact with the form
    await page.type(emailSelector, myEmail, { delay: 80 });
    await page.type(passwordSelector, myPassword, { delay: 120 });

    console.log('[SCRAPER] Submitting login form...');
    await page.click(signInButtonSelector);
    
    console.log(`[SCRAPER] Waiting for redirect to "${successUrl}"...`);
    await page.waitForFunction((url) => window.location.href === url, { timeout: 20000 }, successUrl);
    console.log('[SCRAPER] ✅ Login successful.');
    
    await delay(2000);

    const dynamicUrl = generateReportUrl(start, end);
    console.log(`[SCRAPER] Navigating to reports page: ${dynamicUrl}`);
    await page.goto(dynamicUrl, { waitUntil: 'networkidle2' });
    
    console.log('[SCRAPER] Searching for "Robot Usage Time" value...');
    const usageTimeElement = await page.waitForSelector(robotUsageTimeValueSelector, { timeout: 15000 });
    if (!usageTimeElement) throw new Error('Could not find usage time element on reports page.');
    
    await delay(2000);
    const timeString = await usageTimeElement.evaluate(el => el.textContent);
    console.log('[SCRAPER] Time string====>: ', timeString);
    const totalSeconds = convertTimeToSeconds(timeString);
    
    const dataToStore = {
        COUNT: totalSeconds,
        lastUpdated: new Date().toISOString()
    };
    await fs.writeFile(dataFilePath, JSON.stringify(dataToStore, null, 2));
    console.log(`[SCRAPER] ✅ Success! Saved ${totalSeconds} seconds.`);
    return totalSeconds;

  } catch (error) {
    console.error('[SCRAPER] ❌ Job failed.', error);
  } finally {
    if (browser) {
      await browser.close();
      console.log('[SCRAPER] Browser closed.');
    }
  }
}
