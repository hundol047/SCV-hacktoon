import {test,expect} from '@playwright/test';
import {osmCatalog} from '../../src/adapters/real-data';

test('taxi choices recalculate fare, pin endpoints, include return and survive storage',async({page})=>{
  const catalog=osmCatalog('서울',{elements:[
    {type:'node',id:1,lat:37.57,lon:126.98,tags:{name:'출발 공원',tourism:'attraction'}},
    {type:'node',id:2,lat:37.58,lon:126.99,tags:{name:'중간 박물관',tourism:'museum'}},
    {type:'node',id:3,lat:37.59,lon:127,tags:{name:'마지막 식당',amenity:'restaurant'}},
  ]},new Date().toISOString());
  await page.route('**/api/catalog?*',r=>r.fulfill({json:catalog}));
  await page.goto('/');
  await page.getByRole('button',{name:'우리 부모님 여행 만들기',exact:true}).click();
  await page.getByRole('button',{name:'다음으로',exact:true}).click();
  await page.getByRole('button',{name:'다음으로',exact:true}).click();
  await page.getByRole('button',{name:'이 조건으로 여행 준비하기'}).click();
  await page.getByLabel('데이터 모드').selectOption('real');
  await page.getByLabel('여행 기간').selectOption('1');
  await page.getByLabel('도시와 국가').fill('서울');
  await page.getByRole('button',{name:'실제 장소 조회',exact:true}).click();
  const planner=page.locator('.taxi-planner');
  await planner.locator('summary').click();
  for(const name of ['출발 공원','중간 박물관','마지막 식당']) await planner.getByRole('checkbox',{name:new RegExp(name)}).check();
  await planner.getByLabel('여행 인원',{exact:true}).fill('5');
  await planner.getByLabel('기본요금 가정(원)').fill('4800');
  await planner.getByLabel('km당 요금 가정(원)').fill('0');
  await planner.getByLabel('마지막 도착 장소').selectOption(catalog.places[1].id);
  await planner.getByRole('button',{name:'택시 이동 순서 계산'}).click();
  await expect(planner.locator('.notice')).toContainText('19,200원');
  await expect(planner.locator('.notice li').last()).toHaveText('중간 박물관');
  await planner.getByRole('checkbox',{name:'마지막에 출발지로 복귀'}).check();
  await expect(planner.locator('.notice')).toHaveCount(0);
  await planner.getByRole('button',{name:'택시 이동 순서 계산'}).click();
  await expect(planner.locator('.notice')).toContainText('28,800원');
  await planner.getByLabel('차량당 탑승 인원').fill('6');
  await expect(planner.locator('.notice')).toHaveCount(0);
  await planner.getByRole('button',{name:'택시 이동 순서 계산'}).click();
  await expect(planner.locator('.notice')).toContainText('14,400원');
  await page.getByRole('button',{name:'우리 가족 일정 만들기'}).click();
  await expect(page.locator('.timeline')).toContainText('출발 공원');
  await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bopok:trip:v1')??'null')?.basics.taxiPlan?.estimatedFare)).toBe(14400);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bopok:trip:v1')!));
  expect(saved.items.find((i:{id:string})=>i.id==='taxi-plan:return').toId).toBe(catalog.places[0].id);
  await page.reload();await page.getByRole('button',{name:'이어서 보기',exact:true}).click();
  await expect(page.locator('.timeline')).toContainText('출발 공원');
});
