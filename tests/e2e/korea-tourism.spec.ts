import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {gunzipSync} from 'node:zlib';
test('real nationwide snapshot pages, filters and downloadable source agree',async({request})=>{
 const r=await request.get('/api/tourism?province=KR-11&limit=2');expect(r.status()).toBe(200);const first=await r.json();expect(first.dataset.coverage).toHaveLength(17);expect(first.total).toBeGreaterThan(2);
 const second=await(await request.get('/api/tourism?province=KR-11&limit=2&page=2')).json();expect(second.total).toBe(first.total);expect(second.records.some((r:{id:string})=>first.records.some((f:{id:string})=>f.id===r.id))).toBe(false);
 const lodging=await(await request.get('/api/tourism?category=lodging&limit=100')).json();expect(lodging.total).toBeGreaterThan(0);expect(lodging.records.every((r:{category:string})=>r.category==='lodging')).toBe(true);
 const download=await request.get('/api/tourism/download');expect(download.status()).toBe(200);const dataset=JSON.parse(gunzipSync(await download.body()).toString('utf8'));expect(dataset.records.length).toBe(first.dataset.total);
});
test('national browser searches actual palace data and adds safe real itinerary candidates',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'우리 부모님 여행 만들기',exact:true}).click();await page.getByRole('button',{name:'다음으로',exact:true}).click();await page.getByRole('button',{name:'다음으로',exact:true}).click();await page.getByRole('button',{name:'이 조건으로 여행 준비하기'}).click();
 await page.getByLabel('데이터 모드').selectOption('real');await page.getByRole('button',{name:'전국 수집 자료 열기',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('전국 보관');await page.getByLabel('수집 자료 시·도').selectOption('KR-11');await page.getByLabel('수집 자료 검색어').fill('경복궁');
 await page.getByRole('button',{name:'전국 자료 검색',exact:true}).click();await expect(page.locator('.cloud-panel').filter({has:page.getByRole('heading',{name:'전국 수집 관광 자료',exact:true})})).toContainText('경복궁');
 const a11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(a11y.violations).toEqual([]);
 await page.getByRole('button',{name:'이 지역 후보를 일정에 사용',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'실제 후보'})).toBeVisible();
 await page.getByRole('button',{name:'우리 가족 일정 만들기',exact:true}).click();await expect(page.locator('.timeline')).toContainText('경복궁');await expect(page.getByRole('heading',{name:'정보 부족',exact:true})).toBeVisible();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bopok:trip:v1')!));expect(saved.basics.mode).toBe('real');expect(saved.catalog.region).toBe('서울특별시');expect(saved.catalog.places.every((p:{walkMin:{value:number|null}})=>p.walkMin.value===null)).toBe(true);
});
