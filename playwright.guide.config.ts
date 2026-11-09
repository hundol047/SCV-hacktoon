import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/e2e',testMatch:'record-guide.spec.ts',workers:1,use:{baseURL:'http://localhost:3000',launchOptions:{executablePath:'/usr/bin/chromium'}},webServer:{command:'npm run dev',url:'http://localhost:3000',reuseExistingServer:true,timeout:60000}});
