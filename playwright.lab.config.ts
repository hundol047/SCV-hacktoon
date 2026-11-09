import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:['gangwon-lab.spec.ts','itinerary-map.spec.ts'],workers:2,
 use:{baseURL:'http://localhost:3000',trace:'retain-on-failure',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'}},
 projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}],
 webServer:{command:'npm run dev',url:'http://localhost:3000',reuseExistingServer:true,timeout:60000},
});
