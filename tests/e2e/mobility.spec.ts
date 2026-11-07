import {test,expect} from '@playwright/test';
import {osmCatalog} from '../../src/adapters/real-data';
import {generate} from '../../src/domain/engine';
const catalog=osmCatalog('서울',{elements:[1,2,3,4].map(id=>({type:'node',id,lat:37.5+id/1000,lon:127,tags:{name:'접근성 장소'+id,...(id<=2?{tourism:'museum'}:{amenity:'restaurant'}),wheelchair:'yes',ramp:'yes',step_count:'0'}}))},new Date().toISOString());
test('mobility choices persist through creation and actual place badges are visible',async({page})=>{
 let queried=false;
 await page.route('**/api/tourism?**',r=>{queried=new URL(r.request().url()).searchParams.get('accessibility')==='true';return r.fulfill({json:catalog});});
 await page.route('**/api/location',r=>r.fulfill({json:{locations:[{id:'school',name:'학교',address:'성남시',latitude:37.4,longitude:127.1}]}}));
 await page.route('**/api/departure-hubs',r=>r.fulfill({json:{hubs:[]}}));
 await page.route('**/api/place-details',r=>r.fulfill({json:{places:{}}}));
 await page.route('https://router.project-osrm.org/**',r=>r.abort());
 await page.route('**/api/courses',r=>{const body=r.request().postDataJSON();expect(body.basics.requiredFacilities).toEqual(['wheelchair','ramp']);expect(body.conditions.restMin).toBe(20);return r.fulfill({json:{days:[{day:1,candidateIds:catalog.places.filter(p=>p.kind==='visit').map(p=>p.id)}]}});});
 await page.route('**/api/prepare-trip',r=>{const {basics,conditions,catalog}=r.request().postDataJSON();return r.fulfill({json:{trip:{version:1,id:'mobility-test',revision:0,basics,conditions,catalog,items:generate(conditions,basics,[],[],catalog).items,history:[],feedback:[]}}});});
 await page.goto('/');await page.getByRole('button',{name:'지역 맞춤 여행 시작',exact:true}).click();
 const form=page.getByRole('region',{name:'간편 AI 일정 입력'});
 await form.getByLabel('출발 지역',{exact:true}).fill('학교');await form.getByLabel('여행 지역',{exact:true}).fill('서울');
 for(const label of ['휠체어 진입','경사로']){const input=form.getByRole('checkbox',{name:label,exact:true});await input.check();const checkbox=await input.boundingBox(),row=await input.locator('..').boundingBox();expect(checkbox!.width).toBeLessThan(24);expect(Math.abs(checkbox!.x-row!.x)).toBeLessThan(3);}
 await form.getByRole('combobox',{name:'관광 후 휴식',exact:true}).selectOption('20');
 await form.screenshot({path:`test-results/mobility-${test.info().project.name}.png`});
 await form.getByRole('button',{name:'지역 검색하고 AI 일정 생성'}).click();
 await expect(page.getByRole('heading',{name:'서울 여행',exact:true})).toBeVisible();expect(queried).toBe(true);
 await expect(page.locator('.access-facts').first()).toContainText('휠체어 진입');await expect(page.locator('.access-facts').first()).toContainText('경사로');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bopok:trip:v1')!));expect(saved.basics.requiredFacilities).toEqual(['wheelchair','ramp']);
});
