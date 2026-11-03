import {test,expect} from '@playwright/test';
import {osmCatalog} from '../../src/adapters/real-data';
import AxeBuilder from '@axe-core/playwright';
const catalog=osmCatalog('서울',{elements:[1,2,3,4,5,6].map(i=>({type:'node',id:i,lat:37.57+i/10000,lon:126.98+i/10000,tags:{name:'관광지 '+i,tourism:'museum',indoor:'yes'}}))},new Date().toISOString());
test('five-field region search creates AI itinerary; failed response preserves saved trip',async({page})=>{
 let fail=false;
 await page.route('**/api/tourism?**',r=>r.fulfill({json:catalog}));
 await page.route('**/api/courses',r=>r.fulfill(fail?{status:502,json:{error:'연결 실패. 기존 일정 유지'}}:{json:{candidateIds:catalog.places.slice(0,3).map(p=>p.id)}}));
 await page.goto('/');await page.getByRole('button',{name:'지역 맞춤 여행 시작'}).click();
 const form=page.getByRole('region',{name:'간편 AI 일정 입력'});
 await expect(form.locator('input,select')).toHaveCount(5);await form.getByLabel('여행 지역',{exact:true}).fill('서울');
 await form.getByRole('button',{name:'지역 검색하고 AI 일정 생성'}).click();
 await expect(page.getByRole('heading',{name:'서울 여행',exact:true})).toBeVisible();
 const before=await page.evaluate(()=>localStorage.getItem('bopok:trip:v1'));
 expect(before).toContain('관광지');
 await page.reload();await page.getByRole('button',{name:'지역 맞춤 여행 시작'}).click();
 fail=true;await form.getByLabel('여행 지역',{exact:true}).fill('서울');await form.getByRole('button',{name:'지역 검색하고 AI 일정 생성'}).click();
 await expect(form.getByRole('alert')).toContainText('기존 일정 유지');expect(await page.evaluate(()=>localStorage.getItem('bopok:trip:v1'))).toBe(before);
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
});
test('unconfigured Bedrock fails without rewriting the submitted itinerary',async({request})=>{
 const response=await request.post('/api/courses',{headers:{Origin:'http://127.0.0.1:3000'},data:{}});expect(response.status()).toBe(502);
});
