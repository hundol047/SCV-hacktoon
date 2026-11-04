import {test,expect} from '@playwright/test';
import {osmCatalog} from '../../src/adapters/real-data';
const catalog=osmCatalog('강릉',{elements:[1,2,3].map(id=>({type:'node',id,lat:37.75,lon:128.9+id/1000,tags:{name:'관광지'+id,tourism:'museum'}}))},new Date().toISOString());
test('school search asks user to select among addresses before any paid AI request',async({page})=>{
 let calls=0;await page.route('**/api/tourism?**',r=>r.fulfill({json:catalog}));await page.route('**/api/place-details',r=>r.fulfill({json:{places:{}}}));
 await page.route('**/api/location',r=>{if(r.request().postDataJSON().query.endsWith('버스터미널'))return r.fulfill({json:{locations:[]}});expect(r.request().postDataJSON().query).toBe('판교고등학교');return r.fulfill({json:{locations:[{id:'1',name:'판교고등학교',address:'경기도 성남시 분당구',latitude:37.39,longitude:127.09},{id:'2',name:'다른 검색 결과',address:'다른 주소',latitude:37.4,longitude:127.1}]}});});
 await page.route('**/api/courses',r=>{calls++;expect(r.request().postDataJSON().basics.departureCoordinates).toEqual({latitude:37.39,longitude:127.09});return r.fulfill({json:{days:[{day:1,candidateIds:catalog.places.map(p=>p.id)}]}});});
 await page.goto('/');await page.getByRole('button',{name:'지역 맞춤 여행 시작',exact:true}).click();await page.getByLabel('출발 지역',{exact:true}).fill('판교고등학교');await page.getByLabel('여행 지역',{exact:true}).fill('강릉');
 await page.getByRole('button',{name:'지역 검색하고 AI 일정 생성'}).click();await expect(page.getByRole('group',{name:'어느 출발지인가요?'})).toBeVisible();expect(calls).toBe(0);
 await page.getByRole('button',{name:'판교고등학교 경기도 성남시 분당구'}).click();await page.getByRole('button',{name:'지역 검색하고 AI 일정 생성'}).click();await expect(page.getByRole('heading',{name:'강릉 여행',exact:true})).toBeVisible();expect(calls).toBe(1);
 await expect(page.locator('.credits')).not.toContainText('장소 자료 기준');await expect(page.getByRole('button',{name:'사진·지도 저작권'})).toHaveText('©');await expect(page.getByRole('dialog')).not.toBeVisible();
});
