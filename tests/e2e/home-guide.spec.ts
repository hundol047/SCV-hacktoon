import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test('home has working photo controls and a playable usage video',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 const image=await readFile('public/images/travel-arches.jpg');
 await page.route('https://upload.wikimedia.org/**',r=>r.fulfill({body:image,contentType:'image/jpeg'}));
 await page.goto('/');
 await expect(page.getByRole('button',{name:'예시 체험'})).toHaveCount(0);
 const photo=page.locator('.hero-photo');await expect(photo).toBeVisible();const original=await photo.getAttribute('alt');
 await page.getByRole('button',{name:'다음 관광지 사진'}).click();await expect(photo).not.toHaveAttribute('alt',original!);
 await page.getByRole('button',{name:'이전 관광지 사진'}).click();await expect(photo).toHaveAttribute('alt',original!);
 await page.getByRole('button',{name:'사진 자동 전환 시작'}).click();await expect(page.getByRole('button',{name:'사진 자동 전환 일시정지'})).toBeVisible();
 await expect(photo).not.toHaveAttribute('alt',original!,{timeout:10000});await page.getByRole('button',{name:'사진 자동 전환 일시정지'}).click();
 const video=page.locator('.usage-video video');await video.scrollIntoViewIfNeeded();await expect(video).toHaveAttribute('controls','');
 expect(await video.evaluate((v:HTMLVideoElement)=>v.paused)).toBe(true);
 await video.evaluate(async(v:HTMLVideoElement)=>{await v.play();});
 await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(0.2);
 expect(await video.evaluate((v:HTMLVideoElement)=>v.videoWidth)).toBe(1280);
 await video.evaluate((v:HTMLVideoElement)=>{v.currentTime=10;});
 await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThanOrEqual(10);
});
test('failed external photos give a recoverable state',async({page})=>{
 await page.route('https://upload.wikimedia.org/**',r=>r.abort());await page.goto('/');
 await expect(page.getByRole('button',{name:'사진 다시 불러오기'})).toBeVisible();
 const image=await readFile('public/images/travel-arches.jpg');await page.unroute('https://upload.wikimedia.org/**');await page.route('https://upload.wikimedia.org/**',r=>r.fulfill({body:image,contentType:'image/jpeg'}));
 await page.getByRole('button',{name:'사진 다시 불러오기'}).click();await expect(page.locator('.hero-photo')).toBeVisible();
});
