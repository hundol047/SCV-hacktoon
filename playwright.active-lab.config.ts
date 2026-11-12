import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',testMatch:'active-lab.spec.ts',workers:1,timeout:60000,
  use:{baseURL:'http://localhost:3000',locale:'ko-KR',trace:'retain-on-failure',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'}},
  webServer:{command:'npm run start',url:'http://localhost:3000/lab/',reuseExistingServer:true,timeout:60000},
});
