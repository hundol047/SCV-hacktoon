import {test,expect} from '@playwright/test';
test('email callback removes code from URL and completes login without displaying tokens',async({page})=>{
 let loggedIn=false;let calls=0;
 await page.route('**/api/account',async route=>{
 if(route.request().method()==='POST'){expect(route.request().postDataJSON()).toEqual({action:'exchange',authCode:'synthetic-code'});calls++;loggedIn=true;await route.fulfill({json:{authenticated:true}});}
 else await route.fulfill({json:{configured:true,authenticated:loggedIn,email:loggedIn?'owner@test.invalid':undefined}});
 });
 await page.goto('/?code=synthetic-code');await expect(page.getByText('owner@test.invalid 계정으로 로그인했습니다.')).toBeVisible();expect(new URL(page.url()).searchParams.has('code')).toBe(false);expect(calls).toBe(1);
 await expect(page.getByText('로그인했습니다. 이제 AI 일정을 만들 수 있습니다.')).toBeVisible();
});
