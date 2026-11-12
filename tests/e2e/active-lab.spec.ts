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

test('manual share fallback and trip-isolated evidence with explicit legacy migration',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'share',{configurable:true,value:undefined});
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});
  });
  await page.goto('/lab/',{waitUntil:'domcontentloaded'});
  await page.locator('#halfPkgs summary').click();await page.locator('[data-hp]').first().click();
  await expect(page.locator('[data-proof]').first()).toBeAttached({timeout:30000});
  await page.locator('#shareBtn').click();
  await expect(page.locator('#shareLinkDialog')).toBeVisible();
  await expect(page.locator('#shareLinkText')).toHaveValue(page.url());
  await page.locator('#shareLinkDialog button').click();
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(Error('denied'))}}));
  await page.locator('#shareBtn').click();await expect(page.locator('#shareLinkDialog')).toBeVisible();
  await page.locator('#shareLinkDialog button').click();
  const firstURL=page.url();
  const proof=await page.locator('[data-proof]').first().getAttribute('data-proof');
  const secondURL=await page.evaluate(({proof})=>{
    const snapshot=JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(1)))));
    localStorage.setItem(`proofs:${snapshot.input.region}:${snapshot.input.date}`,JSON.stringify({[proof!]:['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9i8AAAAASUVORK5CYII=']}));
    snapshot.opts.voteKey='secondtrip12';
    return location.origin+location.pathname+'#'+btoa(unescape(encodeURIComponent(JSON.stringify(snapshot))));
  },{proof});
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('[data-import-proof]')).toBeVisible();
  const proofLabel=()=>page.locator('[data-proof]').first().locator('..');
  await expect(proofLabel()).not.toHaveClass(/ok/);
  await page.locator('[data-import-proof]').click();
  await expect(proofLabel()).toHaveClass(/ok/);
  await expect(page.locator('[data-import-proof]')).toHaveCount(0);
  await page.goto(secondURL,{waitUntil:'domcontentloaded'});await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('[data-proof]').first()).toBeAttached();
  await expect(proofLabel()).not.toHaveClass(/ok/);
  await page.goto(firstURL,{waitUntil:'domcontentloaded'});await page.reload({waitUntil:'domcontentloaded'});
  await expect(proofLabel()).toHaveClass(/ok/);
  await expect(page.locator('#costs h3')).toHaveText('결제 예상액');
  expect(errors).toEqual([]);
});
