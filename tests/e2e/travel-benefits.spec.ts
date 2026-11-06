import {test,expect} from '@playwright/test';
import {defaultBasics,defaultConditions,type Trip} from '../../src/domain/schema';
import {osmCatalog} from '../../src/adapters/real-data';
test('regional offers expose conditions without changing the estimate, work in shared plans',async({page},info)=>{
 await page.clock.install({time:new Date('2026-11-06T03:00:00Z')});
 const catalog=osmCatalog('강원특별자치도',{elements:[{type:'node',id:1,lat:38.17,lon:128.49,tags:{name:'설악케이블카',tourism:'attraction'}}]},'2026-11-06T00:00:00Z');
 const trip:Trip={version:1,id:'benefits-test',revision:0,basics:{...defaultBasics,title:'속초 여행',region:'강원특별자치도',date:'2026-11-20',days:1,mode:'real'},conditions:defaultConditions,catalog,history:[],feedback:[],items:[{id:'v',day:1,start:540,end:600,kind:'visit',placeId:catalog.places[0].id,fromId:null,toId:null,transport:null,locked:false,mode:'real'}]};
 await page.addInitScript(t=>localStorage.setItem('bopok:trip:v1',JSON.stringify(t)),trip);
 await page.route('**/api/place-details',r=>r.fulfill({json:{places:{}}}));await page.route('https://router.project-osrm.org/**',r=>r.abort());
 await page.goto('/');await page.getByRole('button',{name:'이어서 보기',exact:true}).click();
 const area=page.getByRole('region',{name:'지역 할인·쿠폰'});await area.locator('.benefit-panel>summary').click();await expect(area).toContainText('설악 케이블카 시민 할인');await expect(area).toContainText('거주자 한정');await expect(area).toContainText('일정 속 장소');
 const amount=await page.locator('.trip-estimate h3').innerText();const cable=area.locator('article').filter({hasText:'설악 케이블카 시민 할인'});await cable.getByText('이용 조건',{exact:true}).click();await expect(cable).toContainText('신분증');await expect(cable.getByRole('link')).toHaveAttribute('href','https://www.sorakcablecar.co.kr/guide');
 await area.getByLabel('혜택 지역').selectOption('제주');await expect(area).toContainText('제주 탐나오');await expect(area).not.toContainText('설악 케이블카 시민 할인');await expect(page.locator('.trip-estimate h3')).toHaveText(amount);
 await area.getByLabel('혜택 지역').selectOption('');await area.scrollIntoViewIfNeeded();await area.screenshot({path:info.outputPath('benefits.png')});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'일정 공유',exact:true}).click();const link=await page.locator('.share-link input').inputValue();await page.goto(link);await expect(page.getByRole('region',{name:'지역 할인·쿠폰'})).toContainText('설악 케이블카 시민 할인');
});
