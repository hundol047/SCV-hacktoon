import {readFileSync} from 'node:fs';
import {test,expect} from '@playwright/test';
import {defaultBasics,defaultConditions,type Trip} from '../../src/domain/schema';
import {osmCatalog} from '../../src/adapters/real-data';
const catalog=osmCatalog('강릉',{elements:[0,1,2].map(i=>({type:'node',id:i+1,lat:37.75+i*.01,lon:128.9,tags:{name:['경포대','박물관','해변'][i],tourism:'attraction'}}))},new Date().toISOString());
const trip:Trip={version:1,id:'map-layout',revision:0,basics:{...defaultBasics,title:'강릉 여행',region:'강릉',days:2,mode:'real',date:'2026-11-20',departureRegion:'태원고',departureCoordinates:{latitude:37.4,longitude:127.1}},conditions:defaultConditions,catalog,history:[],feedback:[],items:[{id:'a',day:1,start:540,end:600,kind:'visit',placeId:catalog.places[0].id,fromId:null,toId:null,transport:null,locked:false,mode:'real'},{id:'b',day:1,start:630,end:700,kind:'visit',placeId:catalog.places[1].id,fromId:null,toId:null,transport:null,locked:false,mode:'real'},{id:'c',day:2,start:540,end:600,kind:'visit',placeId:catalog.places[1].id,fromId:null,toId:null,transport:null,locked:false,mode:'real'},{id:'d',day:2,start:630,end:700,kind:'visit',placeId:catalog.places[2].id,fromId:null,toId:null,transport:null,locked:false,mode:'real'}]};
test('lodging tab preserves photos, route map and day selection',async({page},info)=>{
 await page.addInitScript(t=>localStorage.setItem('bopok:trip:v1',JSON.stringify(t)),trip);
 await page.route('**/api/place-details',r=>r.fulfill({json:{places:{}}}));await page.route('**/api/departure-hubs',r=>r.fulfill({json:{hubs:[]}}));
 await page.route('**/api/lodgings',r=>r.fulfill({json:{hotels:Array.from({length:6},(_,i)=>({id:'h'+i,name:i?'추천 숙소 '+i:'강릉 추천 호텔',address:'강릉시',latitude:37.75,longitude:128.9,distanceKm:.7+i,imageUrl:i===0?'https://lodging.example/photo.png':i===1?'https://lodging.example/missing.png':undefined})),fetchedAt:new Date().toISOString()}}));
 await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')}));
 await page.route('https://router.project-osrm.org/**',r=>{const coords=r.request().url().split('/driving/')[1].split('?')[0].split(';').map(p=>p.split(',').map(Number));const legs=coords.slice(1).map(()=>({duration:600,distance:12000}));return r.fulfill({json:{code:'Ok',waypoints:coords.map(location=>({location})),routes:[{duration:legs.length*600,distance:legs.length*12000,legs,geometry:{type:'LineString',coordinates:coords}}]}});});
 await page.route('https://lodging.example/photo.png',r=>r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')}));await page.route('https://lodging.example/missing.png',r=>r.abort());
 await page.goto('/');await page.getByRole('button',{name:'이어서 보기',exact:true}).click();await page.getByRole('button',{name:'2D 지도',exact:true}).click();await expect(page.locator('.itinerary-map .leaflet-container')).toBeVisible();await expect(page.locator('.itinerary-map .leaflet-overlay-pane path[stroke-width="5"]')).toHaveCount(1);
 await page.getByRole('button',{name:'숙소 비교',exact:true}).click();await expect(page.getByText('강릉 추천 호텔',{exact:true})).toBeVisible();
 const lodging=page.getByRole('region',{name:'추천 호텔과 숙소'});await expect(lodging.locator('article')).toHaveCount(3);await lodging.scrollIntoViewIfNeeded();await expect.poll(()=>lodging.locator('img').first().evaluate((e:HTMLImageElement)=>e.naturalWidth)).toBeGreaterThan(0);await expect(lodging.getByText('사진 준비 중')).toHaveCount(2);await lodging.getByRole('button',{name:'숙소 3곳 더 보기'}).click();await expect(lodging.locator('article')).toHaveCount(6);await lodging.getByRole('button',{name:'접기',exact:true}).click();await expect(lodging.locator('article')).toHaveCount(3);await lodging.screenshot({path:info.outputPath('lodgings.png')});
 await page.getByRole('button',{name:'여행 일정',exact:true}).click();
 await expect(page.locator('.route-stop-order')).not.toContainText('태원고');await page.getByRole('button',{name:'출발지 포함',exact:true}).click();await expect(page.locator('.route-stop-order')).toContainText('태원고');await page.locator('.day-tabs button').nth(1).click();await expect(page.getByRole('heading',{name:'2일차 이동 경로'})).toBeVisible();await expect(page.locator('.route-stop-order')).toContainText('해변');await expect(page.locator('.route-stop-order')).not.toContainText('태원고');await page.getByRole('button',{name:'2D 지도',exact:true}).click();await expect(page.locator('.itinerary-map .leaflet-container')).toBeVisible();await page.locator('.itinerary-map').screenshot({path:info.outputPath('itinerary-map.png')});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('lodging facility filter excludes unknown facts and stores room enquiry separately',async({page},info)=>{
 await page.addInitScript(t=>localStorage.setItem('bopok:trip:v1',JSON.stringify(t)),{...trip,basics:{...trip.basics,requiredFacilities:['ramp'],travelPriority:'comfort'}});
 await page.route('**/api/place-details',r=>r.fulfill({json:{places:{}}}));await page.route('**/api/departure-hubs',r=>r.fulfill({json:{hubs:[]}}));
 await page.route('**/api/lodgings',r=>{expect(r.request().postDataJSON().accessibility).toBe(true);return r.fulfill({json:{hotels:[{id:'confirmed',name:'시설 자료 숙소',address:'강릉',latitude:37.75,longitude:128.9,distanceKm:1,facilities:{ramp:{value:true,evidenceId:'ramp',source:'https://example.com/official',nature:'real',checked:'source',collectedAt:new Date().toISOString()}}},{id:'unknown',name:'문의할 숙소',address:'강릉',latitude:37.75,longitude:128.9,distanceKm:2}],fetchedAt:new Date().toISOString()}});});
 await page.goto('/');await page.getByRole('button',{name:'이어서 보기',exact:true}).click();await page.getByRole('button',{name:'숙소 비교',exact:true}).click();await page.getByRole('checkbox',{name:'요청한 진입·편의 시설이 최근 자료에 등록된 숙소만',exact:true}).check();const lodging=page.getByRole('region',{name:'추천 호텔과 숙소'});await expect(lodging.locator('.lodging-card')).toHaveCount(1);await expect(lodging).not.toContainText('문의할 숙소');await lodging.getByText('동행자에게 맞는 객실 확인',{exact:true}).click();for(const label of ['입구까지 계단 없는 이동','객실까지 엘리베이터 또는 같은 층','객실 문·침대 주변 이동 공간','욕실 문·문턱·손잡이·샤워 공간'])await lodging.getByRole('combobox',{name:label,exact:true}).selectOption('assistance');await lodging.getByLabel('객실 종류·운영자 답변 메모',{exact:true}).fill('가족 객실 문의: 욕실 문턱에 도움 필요');await lodging.getByRole('button',{name:'숙소 문의 결과 저장',exact:true}).click();await expect(lodging).toContainText('운영자 문의 결과를 내 여행에 저장');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bopok:trip:v1')!).comfortReview);expect(saved.reports[0].outcome).toBe('assistance');expect(saved.reports[0].minutes).toBeNull();await lodging.locator('.lodging-access').screenshot({path:info.outputPath('room-check.png')});
});

test('three distinct daily courses update the itinerary and keep map aligned',async({page},info)=>{
 const {regionalCourse}=await import('../../src/domain/regional-course');
 const {savePlan}=await import('../../src/domain/course-plans');
 const many=osmCatalog('강릉',{elements:Array.from({length:14},(_,i)=>({type:'node',id:i+101,lat:37.75+i*.001,lon:128.9,tags:{name:'강릉 관광지 '+i,tourism:'museum'}}))},new Date().toISOString());
 many.places[0].visitorInfo={imageUrl:'https://tong.visitkorea.or.kr/broken.jpg'};
 await page.route('**/broken.jpg',r=>r.abort());
 await page.route('https://tong.visitkorea.or.kr/**',r=>r.request().url().endsWith('/broken.jpg')?r.abort():r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')}));
 let basics={...trip.basics,travelHours:{start:540,end:1110}};
 for(const day of [1,2])basics=savePlan(basics,regionalCourse(basics,defaultConditions,many,day,{candidateIds:many.places.slice((day-1)*2,day*2).map(p=>p.id)}).plan) as typeof basics;
 const rows=basics.coursePlans!.flatMap(p=>p.orderedPlaceIds.flatMap((id,i)=>[{...trip.items[0],id:`${p.day}:${i}`,day:p.day!,start:540+i*100,end:600+i*100,placeId:id},{...trip.items[0],id:`rest:${p.day}:${i}`,day:p.day!,start:600+i*100,end:620+i*100,placeId:id,kind:'rest' as const,label:'휴식'}]));
 const fixture={...trip,catalog:many,basics,items:rows};
 await page.addInitScript(t=>localStorage.setItem('bopok:trip:v1',JSON.stringify(t)),fixture);
 await page.route('**/api/place-details',r=>r.fulfill({json:{places:Object.fromEntries(r.request().postDataJSON().ids.map((id:string)=>[id,{imageUrl:'https://tong.visitkorea.or.kr/gallery.jpg',imageUrls:['https://tong.visitkorea.or.kr/gallery.jpg']}]))}}));await page.route('**/api/departure-hubs',r=>r.fulfill({json:{hubs:[]}}));
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.route('https://router.project-osrm.org/**',r=>{const coords=r.request().url().split('/driving/')[1].split('?')[0].split(';').map(p=>p.split(',').map(Number));const legs=coords.slice(1).map(()=>({duration:600,distance:1000}));return r.fulfill({json:{code:'Ok',waypoints:coords.map(location=>({location})),routes:[{duration:legs.length*600,distance:legs.length*1000,legs,geometry:{type:'LineString',coordinates:coords}}]}});});
 let calls=0;
 await page.route('**/api/edit-course',r=>{calls++;const {trip:t,day,ids}=r.request().postDataJSON();if(calls===1)return r.fulfill({status:422,json:{error:'다시 시도해 주세요.'}});const old=t.basics.coursePlans.find((p:{day:number})=>p.day===day);return r.fulfill({json:{trip:{...t,revision:t.revision+1,basics:savePlan(t.basics,{...old,selectedPlaceIds:ids,orderedPlaceIds:ids,startPlaceId:ids[0]}),items:[...t.items.filter((i:{day:number})=>i.day!==day),...ids.map((id:string,i:number)=>({...t.items[0],id:`updated:${i}`,day,placeId:id,start:540+i*100,end:600+i*100}))]}}});});
 await page.goto('/');await page.getByRole('button',{name:'이어서 보기',exact:true}).click();
 const cards=page.locator('.course-choice-grid article:not(.custom-course)');await expect(cards).toHaveCount(3);
 expect(new Set(await cards.locator('ol').allTextContents()).size).toBe(3);await expect(cards.first().getByRole('img',{name:'강릉 관광지 0 사진'})).toBeVisible();await expect.poll(()=>cards.first().locator('img').first().evaluate((e:HTMLImageElement)=>e.naturalWidth)).toBeGreaterThan(0);
 await expect(page.locator('.compact-stops>li')).toHaveCount(2);
 await expect(page.locator('.compact-stops img')).toHaveCount(2);await expect(cards.first().locator('img').first()).toHaveAttribute('src','https://tong.visitkorea.or.kr/gallery.jpg');await page.locator('.compact-stops img').first().scrollIntoViewIfNeeded();await expect(page.locator('.compact-stops img').first()).toHaveAttribute('src','https://tong.visitkorea.or.kr/gallery.jpg');
 await expect(page.locator('.route-stop-order>span')).toHaveCount(2);
 await page.getByRole('button',{name:'2D 지도',exact:true}).click();await expect(page.locator('.route-number-marker')).toHaveCount(2);
 await expect(page.locator('.leaflet-tooltip')).toHaveCount(0);
 const second=await cards.nth(1).locator('li>span').first().evaluate(e=>Array.from(e.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join(''));
 await cards.nth(1).getByRole('button',{name:'이 코스 선택',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'다시 시도해 주세요.'})).toBeVisible();await expect(cards.first()).toHaveClass(/selected/);
 await cards.nth(1).getByRole('button',{name:'이 코스 선택',exact:true}).click();await expect(cards.nth(1)).toHaveClass(/selected/);await expect(page.locator('.compact-stops')).toContainText(second!);
 await page.locator('.day-tabs button').nth(1).click();await expect(cards).toHaveCount(3);
 const map=await page.locator('.itinerary-map').boundingBox(),stops=await page.locator('.lab-route-stops').boundingBox();
 expect(map!.y+map!.height).toBeLessThanOrEqual(stops!.y);const choices=await page.locator('.daily-course-options').boundingBox();if(info.project.name==='desktop'){expect(map!.x).toBeGreaterThan(choices!.x);expect(map!.height).toBeLessThan(720);}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.daily-course-options').screenshot({path:info.outputPath('course-options.png')});
});

test('coupon and travel-tool disclosures are compact and keyboard accessible',async({page},info)=>{
 await page.addInitScript(t=>localStorage.setItem('bopok:trip:v1',JSON.stringify(t)),trip);
 await page.route('**/api/place-details',r=>r.fulfill({json:{places:{}}}));await page.route('**/api/departure-hubs',r=>r.fulfill({json:{hubs:[]}}));await page.route('https://router.project-osrm.org/**',r=>r.abort());
 await page.goto('/');await page.getByRole('button',{name:'이어서 보기',exact:true}).click();
 await page.getByRole('button',{name:'예산·할인',exact:true}).click();
 const coupon=page.locator('summary').filter({hasText:'직접 확인한 할인권 추가'});
 expect((await coupon.boundingBox())!.height).toBeLessThanOrEqual(56);
 await coupon.click();await expect(page.getByLabel('할인권 이름',{exact:true})).toBeVisible();await coupon.click();
 await page.getByRole('button',{name:'여행 도우미',exact:true}).click();
 for(const name of ['날짜별 시간·예산·코스 조정','지도 저장']){
  const summary=page.locator('summary').filter({hasText:name});expect((await summary.boundingBox())!.height).toBeLessThanOrEqual(56);
  await summary.focus();await page.keyboard.press('Enter');await expect(summary.locator('..')).toHaveAttribute('open','');
  await page.keyboard.press('Enter');await expect(summary.locator('..')).not.toHaveAttribute('open','');
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#trip-pane-tools').screenshot({path:info.outputPath('compact-tool-panels.png')});
});

test('3D terrain renders and overlapping places remain individually readable',async({page},info)=>{
 const overlap=structuredClone(trip);overlap.catalog!.places[1].latitude=overlap.catalog!.places[0].latitude;overlap.catalog!.places[1].longitude=overlap.catalog!.places[0].longitude;
 await page.addInitScript(t=>localStorage.setItem('bopok:trip:v1',JSON.stringify(t)),overlap);
 await page.route('**/api/place-details',r=>r.fulfill({json:{places:{}}}));await page.route('**/api/departure-hubs',r=>r.fulfill({json:{hubs:[]}}));
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
 await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/png',body:png}));await page.route('https://s3.amazonaws.com/**',r=>r.fulfill({contentType:'image/png',body:readFileSync(new URL('../fixtures/flat-terrain.png',import.meta.url))}));
 await page.route('https://router.project-osrm.org/**',r=>{const coords=r.request().url().split('/driving/')[1].split('?')[0].split(';').map(p=>p.split(',').map(Number));const legs=coords.slice(1).map(()=>({duration:600,distance:1000}));return r.fulfill({json:{code:'Ok',waypoints:coords.map(location=>({location})),routes:[{duration:legs.length*600,distance:legs.length*1000,legs,geometry:{type:'LineString',coordinates:coords}}]}});});
 await page.goto('/');await page.getByRole('button',{name:'이어서 보기',exact:true}).click();await expect(page.getByRole('button',{name:'3D 지형',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.terrain-road-map canvas')).toBeVisible();await expect(page.locator('.terrain-stop-marker')).toHaveCount(1,{timeout:20000});await expect(page.locator('.terrain-stop-marker')).toHaveText('2곳');await page.locator('.terrain-stop-marker').click();
 await expect(page.locator('.maplibregl-popup')).toContainText('경포대');await expect(page.locator('.maplibregl-popup')).toContainText('박물관');await expect(page.locator('.map-stop-picker button')).toHaveCount(2);
 const bounds=await page.locator('.terrain-road-map').boundingBox(),popup=await page.locator('.maplibregl-popup').boundingBox();expect(popup!.y).toBeGreaterThanOrEqual(bounds!.y);expect(popup!.y+popup!.height).toBeLessThanOrEqual(bounds!.y+bounds!.height);await page.locator('.itinerary-map').screenshot({path:info.outputPath('terrain-map.png')});
 await page.getByRole('button',{name:'2D 지도',exact:true}).click();await expect(page.locator('.leaflet-container')).toBeVisible();
});

test('lodging comparison shows before and after costs and places before applying',async({page},info)=>{
 await page.addInitScript(t=>localStorage.setItem('bopok:trip:v1',JSON.stringify(t)),trip);
 await page.route('**/api/place-details',r=>r.fulfill({json:{places:{}}}));await page.route('https://router.project-osrm.org/**',r=>r.abort());
 await page.route('**/api/lodgings',r=>r.fulfill({json:{hotels:[{id:'compare-hotel',name:'비교할 강릉 호텔',address:'강릉시',latitude:37.75,longitude:128.9,distanceKm:1}],fetchedAt:new Date().toISOString()}}));
 await page.route('**/api/adjust-trip',r=>{const body=r.request().postDataJSON();return r.fulfill({json:{trip:{...body.trip,revision:body.trip.revision+1,basics:body.basics,items:body.trip.items.map((i:any)=>i.id==='a'?{...i,placeId:catalog.places[2].id}:i)}}});});
 await page.goto('/');await page.getByRole('button',{name:'이어서 보기',exact:true}).click();await page.getByRole('button',{name:'숙소 비교',exact:true}).click();
 await page.getByRole('button',{name:'동선·비용 비교',exact:true}).click();const comparison=page.getByRole('region',{name:'숙소 비교 결과',exact:true});await expect(comparison).toBeVisible();await expect(comparison).toBeFocused();
 await expect(comparison.getByRole('columnheader',{name:'변경 전',exact:true})).toBeVisible();await expect(comparison.getByRole('columnheader',{name:'변경 후',exact:true})).toBeVisible();await expect(comparison).toContainText('비교할 강릉 호텔');await expect(comparison).toContainText('이동 시간');await expect(comparison).toContainText('예상 총비용');await expect(comparison).toContainText('해변');
 expect((await page.evaluate(()=>JSON.parse(localStorage.getItem('bopok:trip:v1')!))).basics.lodgings??[]).toHaveLength(0);
 await comparison.getByRole('button',{name:'변경 일정 적용',exact:true}).click();await expect(page.getByText('선택한 숙소:',{exact:false})).toContainText('비교할 강릉 호텔');
 await page.getByRole('button',{name:'예산·할인',exact:true}).click();await expect(page.locator('.estimate-head h3')).toContainText('–');await expect(page.locator('.cost-certainty')).toContainText('확정 금액을 산정하지 않습니다');await expect(page.locator('.cost-certainty')).toContainText('미포함 비용');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('.trip-estimate').screenshot({path:info.outputPath('cost-range.png')});
});

test('custom course accepts dragged or tapped places and immediately applies arrangement',async({page},info)=>{
 const {regionalCourse}=await import('../../src/domain/regional-course');const {savePlan}=await import('../../src/domain/course-plans');
 const many=osmCatalog('강릉',{elements:Array.from({length:8},(_,i)=>({type:'node',id:i+101,lat:37.75+i*.001,lon:128.9,tags:{name:'선택 관광지 '+i,tourism:'attraction'}}))},new Date().toISOString());
 const b={...trip.basics,days:1,travelHours:{start:540,end:1200}};const plan=regionalCourse(b,defaultConditions,many,1,{candidateIds:many.places.slice(0,2).map(p=>p.id)}).plan;const fixture={...trip,basics:savePlan(b,plan),catalog:many,items:plan.orderedPlaceIds.map((id,i)=>({...trip.items[0],id:'custom:'+i,placeId:id,start:540+i*100,end:600+i*100}))};
 await page.addInitScript(t=>localStorage.setItem('bopok:trip:v1',JSON.stringify(t)),fixture);await page.route('**/api/place-details',r=>r.fulfill({json:{places:{}}}));await page.route('https://router.project-osrm.org/**',r=>r.abort());
 let requested:string[]=[];await page.route('**/api/edit-course',r=>{const data=r.request().postDataJSON();expect(data.optimize).toBe(true);requested=data.ids;const order=[...data.ids].reverse();return r.fulfill({json:{trip:{...data.trip,revision:data.trip.revision+1,basics:savePlan(data.trip.basics,{...plan,orderedPlaceIds:order,selectedPlaceIds:order,startPlaceId:order[0]}),items:order.map((id:string,i:number)=>({...trip.items[0],id:'arranged:'+i,placeId:id,start:540+i*100,end:600+i*100}))}}});});
 await page.goto('/');await page.getByRole('button',{name:'이어서 보기',exact:true}).click();await expect(page.getByRole('article',{name:'코스 C',exact:true})).toBeVisible();const custom=page.getByRole('article',{name:'내 맘대로 여행',exact:true});const first=page.getByRole('article',{name:'코스 A',exact:true}).locator('li').first();
 if(info.project.name==='desktop')await first.dragTo(custom);else await first.getByRole('button',{name:/내 여행에 담기/}).click();await expect(custom.locator('li')).toHaveCount(1);
 await page.getByRole('article',{name:'코스 A',exact:true}).locator('li').nth(1).getByRole('button',{name:/내 여행에 담기/}).click();await expect(custom.locator('li')).toHaveCount(2);await custom.getByRole('button',{name:'효율적으로 자동 배치'}).click();await expect(custom.getByRole('button',{name:'자동 배치 완료 · 다시 계산',exact:true})).toBeVisible();expect(requested).toHaveLength(2);await expect.poll(async()=> (await page.evaluate(()=>JSON.parse(localStorage.getItem('bopok:trip:v1')!))).revision).toBe(1);await expect(custom.locator('li').first()).toContainText('선택 관광지 1');await expect(custom.locator('li').first()).toContainText('09:00');await expect(page.getByRole('region',{name:'내 여행 자동 배치 결과',exact:true})).toHaveCount(0);if(info.project.name==='desktop'){const bottoms=await page.locator('.course-choice-grid article>button:last-child').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().bottom));expect(Math.max(...bottoms)-Math.min(...bottoms)).toBeLessThan(3);}expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.daily-course-options').screenshot({path:info.outputPath('custom-course.png')});
});
