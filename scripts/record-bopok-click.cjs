const {chromium}=require('playwright');const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1600,height:900},locale:'ko-KR',recordVideo:{dir:'artifacts/video/click-demo/raw',size:{width:1600,height:900}}});
 // Supply the same hotels' real photos from the user's screenshot as a local recording cache.
 const source=fs.readFileSync('artifacts/ir/user-screens/result.png').toString('base64');
 const photoCache=[['https://tong.visitkorea.or.kr/cms/resource/28/3504828_image2_1.jpg',514,712,259,112],['https://tong.visitkorea.or.kr/cms/resource/29/3372129_image2_1.jpg',811,712,259,112]];
 let photoHits=0;
 for(const [url,x,y,w,h] of photoCache)await context.route(url,route=>{photoHits++;return route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}"><image href="data:image/png;base64,${source}" width="1879" height="938"/></svg>`})});

 const beachSource=fs.readFileSync('artifacts/ir/user-screens/place.png').toString('base64');
 await context.route('https://tong.visitkorea.or.kr/cms/resource/38/3341438_image2_1.jpg',r=>r.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="77" height="77" viewBox="1 4 77 77"><image href="data:image/png;base64,${beachSource}" width="385" height="265"/></svg>`}));
 const homeSource=fs.readFileSync('artifacts/ir/user-screens/home.png').toString('base64');
 await context.route('https://tong.visitkorea.or.kr/cms/resource/19/3492919_image2_1.jpg',r=>r.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="437" height="175" viewBox="512 110 437 175"><image href="data:image/png;base64,${homeSource}" width="1883" height="902"/></svg>`}));
 const page=await context.newPage();const start=Date.now();const cues=[];
 const elapsed=()=> (Date.now()-start)/1000;
 const wait=ms=>page.waitForTimeout(ms);
 async function cue(chapter,caption,action,hold=7000){const t=elapsed();console.log(chapter,Math.round(t));if(action)await action();await wait(hold);cues.push({start:t,end:elapsed(),chapter,caption});}
 async function focus(selector){await page.locator(selector).first().evaluate(e=>window.scrollTo({top:Math.max(0,e.getBoundingClientRect().top+scrollY-110),behavior:'smooth'}));await wait(900);}
 async function click(selector){const e=page.locator(selector).first();await e.scrollIntoViewIfNeeded();const b=await e.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:25});await wait(350);await page.mouse.click(b.x+b.width/2,b.y+b.height/2);}
 await page.goto('http://localhost:3000/lab/',{waitUntil:'domcontentloaded'});
 await page.addStyleTag({content:'html{scroll-behavior:smooth}'});
 await page.evaluate(()=>{const c=document.createElement('div');c.style='position:fixed;width:22px;height:22px;border:3px solid #f1a237;border-radius:50%;pointer-events:none;z-index:999999;transform:translate(-50%,-50%);left:-100px;top:-100px;background:#fff6;';document.body.append(c);document.addEventListener('mousemove',e=>{c.style.left=e.clientX+'px';c.style.top=e.clientY+'px'});});
 await cue('01 함께 떠나는 여행','보폭은 동행자의 이동 조건에서 여행을 시작합니다.',null,6500);
 await cue('02 동행자 선택','어르신·아이·휠체어 동행 유형을 선택할 수 있습니다.',async()=>{await focus('.profile-start');await page.locator('[data-profile="senior"]').hover()},6500);
 await cue('03 여행 조건 입력','이번에는 어르신과 함께하는 강릉 여행을 준비합니다.',async()=>{await click('[data-profile="senior"]');await focus('#form')},7000);
 await cue('03 여행 조건 입력','날짜와 기간을 선택합니다. 3박 4일 일정으로 만들어 볼게요.',async()=>{await page.locator('#date').fill('2026-11-12');await click('[data-name="days"] [data-v="4"]')},7000);
 await cue('04 이동 부담 줄이기','어르신 동행과 짧게 걷기 조건이 선택되어 있습니다.',async()=>{await focus('[data-name="who"]')},8000);
 await cue('04 이동 부담 줄이기','필요한 경우 휠체어 진입·화장실·유모차 조건도 선택합니다.',async()=>{await focus('[data-name="access"]')},8000);
 await cue('05 일정 만들기','선택한 조건으로 여행 일정을 생성합니다.',async()=>{await click('#form button[type="submit"]');await page.locator('#result').waitFor({state:'visible',timeout:30000});await focus('#tripTitle')},6500);
 await cue('06 세 가지 코스 비교','추천·여유롭게·색다른 코스를 비교해 선택할 수 있습니다.',async()=>{await focus('#options')},8000);
 await cue('06 세 가지 코스 비교','이동 시간과 방문 장소를 보고 나에게 맞는 코스를 고릅니다.',async()=>{await page.locator('[data-opt="relaxed"]').hover()},7000);
 await cue('07 숙소 확인','여행 권역의 숙소와 날짜·객실 조건을 함께 확인합니다.',async()=>{await focus('#lodgingCard');await page.waitForTimeout(500);await page.locator('#lodgingCard').screenshot({path:'artifacts/video/click-demo/hotels-check.png'})},8000);
 await cue('07 숙소 확인','예약 검색은 외부 예약 사이트로 연결됩니다.',async()=>{await page.locator('#lodgingCard .stay-acts a').first().hover()},6000);
 await cue('08 날짜별 일정','날짜별 탭을 통해 각 날의 일정을 살펴봅니다.',async()=>{await focus('#tabs');await click('#tabs button[data-i="3"]')},6500);
 await cue('09 장소 정보','장소 소개와 운영시간, 편의시설 정보를 확인합니다.',async()=>{await focus('.place:has([data-photo="namhangjin-beach"])');await page.waitForTimeout(900);await page.locator('.place:has([data-photo="namhangjin-beach"])').screenshot({path:'artifacts/video/click-demo/attraction-check.png'});const photo=page.locator('[data-photo="namhangjin-beach"]');if(!await photo.evaluate(e=>e.classList.contains('has-img')))throw new Error('Attraction photo failed')},8000);
 const details=page.locator('.place:has([data-photo="namhangjin-beach"])').locator('details').first();
 await cue('09 장소 정보','시설 정보의 근거를 펼쳐 보고 방문 조건을 확인합니다.',async()=>{if(await details.count())await details.locator('summary').click()},7000);
 await cue('10 다른 날짜 확인','다른 날짜의 일정도 선택한 이동 조건에 맞춰 확인합니다.',async()=>{await focus('#tabs');await click('#tabs button[data-i="1"]');await focus('#timeline .place')},7000);
 await cue('11 일정 저장','완성한 일정은 저장해 다시 확인할 수 있습니다.',async()=>{await focus('#tripTitle');await click('#saveTripBtn')},6500);
 await cue('12 누구와 함께 떠나나요?','아이와 함께하는 여행도 시작 유형에서 선택할 수 있습니다.',async()=>{await click('#editBtn');await click('#home');await focus('.profile-start');await page.locator('[data-profile="child"]').hover()},7000);
 fs.writeFileSync('artifacts/video/click-demo/cues.json',JSON.stringify({cues,duration:elapsed()},null,2));
 if(photoHits<2)throw new Error('Hotel photograph cache was not used');console.log('Verified real hotel photos:',photoHits);
 const video=page.video();await context.close();await video.saveAs('artifacts/video/click-demo/bopok-live.webm');await browser.close();console.log('DONE',elapsed());
})().catch(e=>{console.error(e);process.exit(1)});
