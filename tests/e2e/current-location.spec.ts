import {test,expect} from '@playwright/test';
test('current location fills departure and feeds nearby hubs; editing resets coordinates',async({page,context})=>{
 await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:37.4,longitude:127.1});
 await page.route('**/api/location/current',r=>{expect(r.request().postDataJSON()).toEqual({latitude:37.4,longitude:127.1});return r.fulfill({json:{location:{id:'current-location',name:'현재 위치',address:'경기도 성남시 분당구',latitude:37.4,longitude:127.1}}});});
 await page.route('**/api/departure-hubs',r=>{expect(r.request().postDataJSON()).toMatchObject({latitude:37.4,longitude:127.1});return r.fulfill({json:{hubs:[]}});});
 await page.goto('/');await page.getByRole('button',{name:'지역 맞춤 여행 시작',exact:true}).click();
 await page.getByRole('button',{name:'현재 위치',exact:true}).click();await expect(page.getByLabel('출발 지역',{exact:true})).toHaveValue('경기도 성남시 분당구');await expect(page.locator('.selected-location')).toContainText('경기도 성남시 분당구');
 await page.getByLabel('출발 지역',{exact:true}).fill('서울역');await expect(page.locator('.selected-location')).toHaveCount(0);
});
test('permission denial preserves manual departure',async({page})=>{
 await page.addInitScript(()=>{navigator.geolocation.getCurrentPosition=(_success,error)=>error?.({code:1,message:'denied',PERMISSION_DENIED:1,POSITION_UNAVAILABLE:2,TIMEOUT:3});});
 await page.goto('/');await page.getByRole('button',{name:'지역 맞춤 여행 시작',exact:true}).click();await page.getByLabel('출발 지역',{exact:true}).fill('서울역');await page.getByRole('button',{name:'현재 위치',exact:true}).click();await expect(page.locator('.location-status')).toContainText('위치 권한');await expect(page.getByLabel('출발 지역',{exact:true})).toHaveValue('서울역');
});
