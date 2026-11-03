import {test,expect} from '@playwright/test';
import {osmCatalog} from '../../src/adapters/real-data';
test('forecast applies only on confirmation; in-app road preview persists time facts and handles provider failure',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const date=new Date().toISOString().slice(0,10);
 const catalog=osmCatalog('서울',{elements:[1,2,3].map(i=>({type:'node',id:i,lat:37.55+i/1000,lon:126.97+i/1000,tags:{name:'테스트 관광'+i,tourism:'museum',indoor:'yes'}}))},new Date().toISOString());
 await page.route('**/api/catalog?*',r=>r.fulfill({json:catalog}));
 await page.route('https://api.open-meteo.com/**',r=>r.fulfill({json:{timezone:'Asia/Seoul',daily:{time:[date],weather_code:[61],temperature_2m_max:[23],temperature_2m_min:[17],precipitation_probability_max:[80],wind_speed_10m_max:[20]},current:{temperature_2m:20,time:date+'T10:00'}}}));
 await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')}));
 await page.route('https://router.project-osrm.org/**',r=>{
  const coords=new URL(r.request().url()).pathname.split('/').pop()!.split(';').map(p=>p.split(',').map(Number));
  return r.fulfill({json:{code:'Ok',routes:[{distance:1450,duration:420,geometry:{type:'LineString',coordinates:coords}}]}});
 });
 await page.goto('/');await page.getByRole('button',{name:'자가용 여행 빠르게 만들기',exact:true}).click();
 await page.locator('input[type=date]').first().fill(date);await page.getByLabel('여행 기간').selectOption('1');
 await page.getByLabel('도시와 국가').fill('서울');await page.getByRole('button',{name:'실제 장소 조회',exact:true}).click();
 const course=page.locator('.regional-course');await course.getByRole('button',{name:'현재 날씨·여행일 예보 조회',exact:true}).click();
 await expect(course).toContainText('강수확률 80%');await expect(course.getByLabel('여행일 날씨 가정')).toHaveValue('unknown');
 await course.getByRole('button',{name:'이 예보를 코스 추천에 적용',exact:true}).click();await expect(course.getByLabel('여행일 날씨 가정')).toHaveValue('rain');
 await course.getByRole('button',{name:'API 키 없이 기본 코스 보기',exact:true}).click();await course.getByRole('button',{name:'이 코스를 일정에 적용',exact:true}).click();
 await page.getByRole('button',{name:'맞춤 코스 일정 만들기',exact:true}).click();await page.locator('.timeline').waitFor();
 const road=page.locator('.live-road-route');await road.getByRole('button',{name:'API 키 없이 도로 경로 조회',exact:true}).click();
 await expect(road).toContainText('도로 거리 1.45km');await expect(road).toContainText('자동차 예상 7분');await expect(road.locator('.leaflet-container')).toBeVisible();
 await road.getByRole('button',{name:'도로 예상 시간을 일정 점검에 반영',exact:true}).click();
 const trip=await page.evaluate(()=>JSON.parse(localStorage.getItem('bopok:trip:v1')!));expect(trip.catalog.routes.some((r:any)=>r.duration.value===7&&r.cost.value===null)).toBe(true);expect(trip.basics.coursePreferences[0].forecast.rainChance).toBe(80);
 // Change the selected leg, making the previous geometry inapplicable.
 await road.getByLabel('확인할 차량 이동 구간').selectOption({index:1});await expect(road.locator('.leaflet-container')).toHaveCount(0);
 await page.route('https://router.project-osrm.org/**',r=>r.fulfill({status:503,json:{error:'fixture failure'}}));
 await page.reload();await page.getByRole('button',{name:'이어서 보기',exact:true}).click();
 await road.getByRole('button',{name:'API 키 없이 도로 경로 조회',exact:true}).click();await expect(road).toContainText('외부 서버에 연결하지 못했습니다');await expect(road.locator('.leaflet-container')).toHaveCount(0);expect(errors).toEqual([]);
});
