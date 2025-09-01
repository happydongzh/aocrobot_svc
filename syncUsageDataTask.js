(async () => {
 const  module =  await import('./lib/scrapeRobotUsage.mjs');
    process.env.SCRAPER_EMAIL = 'lizhenghuang@cmi.chinamobile.com'
    process.env.SCRAPER_PASSWORD = 'robotAtPpa9';
    const result = await module.scrapeAndStoreUsageTime();
    console.log(result);
})();


