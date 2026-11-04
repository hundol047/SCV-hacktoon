import {test,expect} from '@playwright/test';
import {osmCatalog} from '../../src/adapters/real-data';
const catalog=osmCatalog('강릉',{elements:Array.from({length:9},(_,i)=>({type:'node',id:i+1,lat:37.75+i/1000,lon:128.9,tags:{name:'관광지 '+i,tourism:'museum'}}))},new Date().toISOString());
test('three-day AI trip is generated and saved when randomUUID is unavailable',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(window.crypto,'randomUUID',{value:undefined,configurable:true}));
 let calls=0;
 await page.route('**/api/place-details',r=>r.fulfill({json:{places:{}}}));
 await page.route('**/api/tourism?**',r=>r.fulfill({json:catalog}));
 await page.route('**/api/courses',r=>{const body=r.request().postDataJSON();expect(body.basics.departureRegion).toBe('서울');expect(body.basics.travelers).toBe(5);const day=body.day;calls++;return r.fulfill({json:{candidateIds:catalog.places.slice((day-1)*3,day*3).map(p=>p.id)}});});
 await page.goto('/');expect(await page.evaluate(()=>typeof crypto.randomUUID)).toBe('undefined');
 const login=page.locator('.header-account summary');await expect(login).toHaveText('로그인');await expect(login).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await expect(login).toHaveCSS('border-top-width','0px');
 await page.getByRole('button',{name:'지역 맞춤 여행 시작',exact:true}).click();
 const form=page.getByRole('region',{name:'간편 AI 일정 입력'});await expect(form).not.toContainText('Amazon Bedrock');
 await form.getByLabel('출발 지역',{exact:true}).fill('서울');await form.getByLabel('여행 지역',{exact:true}).fill('강릉');await form.getByRole('combobox',{name:'여행 기간',exact:true}).selectOption('3');
 await form.getByRole('combobox',{name:'여행 인원',exact:true}).selectOption('5');await form.getByRole('button',{name:'지역 검색하고 AI 일정 생성'}).click();
 await expect(page.getByRole('heading',{name:'강릉 여행',exact:true})).toBeVisible();expect(calls).toBe(3);await expect(page.getByRole('region',{name:'여행 코스'})).not.toContainText('미확인');await expect(page.getByRole('region',{name:'여행 코스'})).toContainText('5명');await expect(page.getByRole('region',{name:'여행 코스'})).toContainText('택시 2대');await expect(page.getByRole('region',{name:'여행 코스'}).locator('table')).toHaveCount(0);
 const trip=await page.evaluate(()=>JSON.parse(localStorage.getItem('bopok:trip:v1')!));expect(trip.id).toMatch(/^[0-9a-f-]{36}$/);expect(trip.basics.days).toBe(3);expect(trip.items.length).toBeGreaterThan(0);
 await page.reload();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('bopok:trip:v1')!).id)).toBe(trip.id);
});
