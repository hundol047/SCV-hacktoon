import {test,expect} from '@playwright/test';
test('login is available above trip content on desktop and mobile',async({page})=>{
 await page.goto('/');const panel=page.locator('.top-account');await expect(panel).toBeVisible();await expect(page.locator('.top-account summary')).toHaveText('계정 로그인');
 const box=await panel.boundingBox();expect(box!.y).toBeLessThan(200);expect(await page.locator('.cloud-panel > summary').filter({hasText:'계정 로그인'}).count()).toBe(1);
 await panel.locator('summary').click();await expect(panel.getByLabel('로그인 이메일')).toBeVisible();
 await page.getByRole('button',{name:'지역 맞춤 여행 시작',exact:true}).click();await expect(panel).toBeVisible();await expect(page.locator('.form-workspace input,.form-workspace select')).toHaveCount(5);
});
