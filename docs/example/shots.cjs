const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const OUT = __dirname + '/img';
const shots = [
  { name: 'product',    url: '/teamspace/',                                     sel: 'main' },
  { name: 'nav',        url: '/',                                              sel: 'aside' },
  { name: 'feature',    url: '/teamspace/team/invite-teammate',                          sel: 'main' },
  { name: 'capability', url: '/capabilities/user-account-manager/invite-user',  sel: 'main' },
  { name: 'area',       url: '/teamspace/team/',                                          sel: 'main' },
  { name: 'strategy',   url: '/_context',                                      sel: 'main' },
  { name: 'standalone', url: '/teamspace/pricing/seat-estimator',                         sel: 'main' },
  { name: 'undefined',  url: '/teamspace/team/accept-invite',                             sel: 'main' },
];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1180, height: 1400 }, deviceScaleFactor: 2 });
  for (const s of shots) {
    await p.goto('http://localhost:7881' + s.url, { waitUntil: 'load' });
    await p.waitForTimeout(500);
    const el = await p.$(s.sel);
    if (!el) { console.log('MISSING', s.name, s.url); continue; }
    await el.screenshot({ path: OUT + '/' + s.name + '.png' });
    console.log('ok', s.name, s.url);
  }
  await b.close();
})();
