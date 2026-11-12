import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('active app preserves half-price drafts and selected courses on mobile',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/lab/',{waitUntil:'domcontentloaded'});
  await page.locator('#halfPkgs summary').click();
  await page.locator('[data-hp]').first().click();
  const draft=page.locator('[data-half-draft]').first();
  await expect(draft).toBeVisible({timeout:30000});
  await expect(draft).toHaveValue(/예정 일정/);
  await draft.fill('검증용 신청 메모\n영수증 확인 후 작성');
  const pending=page.waitForEvent('download');
  await page.locator('[data-half-download]').first().click();
  const download=await pending;
  expect(download.suggestedFilename()).toMatch(/보폭_반값여행/);
  expect(await readFile((await download.path())!,'utf8')).toContain('검증용 신청 메모');
  await page.locator('[data-opt="relaxed"]').click();
  await expect(page.locator('[data-opt="relaxed"]')).toHaveClass(/on/);
  await expect(page.locator('#options')).toContainText('예상 보행');
  await page.locator('[data-opt="best"]').click();
  await expect(draft).toHaveValue('검증용 신청 메모\n영수증 확인 후 작성');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
