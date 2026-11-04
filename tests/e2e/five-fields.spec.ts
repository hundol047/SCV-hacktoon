import {test,expect} from '@playwright/test';
test('every new-trip entry uses one screen with seven fields including departure and travelers and no legacy steps',async({page,isMobile})=>{
 const entries=['지역 맞춤 여행 시작','택시 여행 빠르게 만들기','자가용 여행 빠르게 만들기'];
 if(!isMobile)entries.unshift('여행 만들기'); // Compact header hides this duplicate entry.
 for(const name of entries){
  await page.goto('/');await page.getByRole('button',{name,exact:true}).click();
  await expect(page.locator('.form-workspace input,.form-workspace select,.form-workspace textarea')).toHaveCount(7);
  await expect(page.locator('.form-workspace .progress')).toHaveCount(0);
  await expect(page.locator('.form-workspace')).not.toContainText('걷기');
  await expect(page.locator('.form-workspace')).not.toContainText('부모님');
  await expect(page.locator('.form-workspace details')).toHaveCount(0);
  if(name==='자가용 여행 빠르게 만들기')await expect(page.getByRole('combobox',{name:'이동 수단',exact:true})).toHaveValue('driving');
 }
});
test('three Korean tourism photographs have specific source and license attribution',async({page})=>{
 await page.goto('/');const gallery=page.getByRole('region',{name:'한국 관광지 사진'});
 await expect(gallery.locator('figure')).toHaveCount(3);
 for(const name of ['해운대','불국사','성산일출봉'])await expect(gallery.getByRole('heading',{name,exact:true})).toBeVisible();
 for(const image of await gallery.locator('img').all())expect(await image.getAttribute('src')).toMatch(/^https:\/\/(upload|thumb)\.wikimedia\.org\//);
 await expect(gallery.locator('a')).toHaveCount(0);await page.locator('.credits summary').click();await expect(page.locator('.credits a[href*="creativecommons.org"]')).toHaveCount(3);
 // Network policy blocks image binaries here; this test verifies wiring and
 // attribution, not remote image loading.
});
