import {test,expect} from '@playwright/test';
test('login is available above trip content on desktop and mobile',async({page})=>{
 await page.goto('/');const panel=page.locator('.header-account');await expect(panel).toBeVisible();await expect(page.locator('.header-account summary')).toHaveText('로그인');
 const box=await panel.boundingBox();expect(box!.y).toBeLessThan(100);expect(box!.width).toBeLessThan(110);expect(await page.locator('.cloud-panel > summary').filter({hasText:'로그인'}).count()).toBe(1);
 await panel.locator('summary').click();await expect(panel.getByLabel('로그인 이메일')).toBeVisible();const pop=await page.locator('.account-popover').boundingBox();expect(pop!.x).toBeGreaterThanOrEqual(0);expect(pop!.x+pop!.width).toBeLessThanOrEqual(page.viewportSize()!.width);await panel.locator('summary').click();
 await page.getByRole('button',{name:'지역 맞춤 여행 시작',exact:true}).click();await expect(panel).toBeVisible();await expect(page.locator('.form-workspace input,.form-workspace select')).toHaveCount(5);
});
