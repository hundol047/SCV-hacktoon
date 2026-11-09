import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {defaultBasics,defaultConditions} from '../../src/domain/schema';
import {osmCatalog} from '../../src/adapters/real-data';
const output='/tmp/yeohaengit-guide';
test('record current comfort travel and evidence workflow',async({browser})=>{
 test.skip(!process.env.RECORD_GUIDE,'Manual video production');test.setTimeout(180000);mkdirSync(output,{recursive:true});
 const context=await browser.newContext({baseURL:'http://localhost:3000',viewport:{width:1920,height:1080},recordVideo:{dir:output,size:{width:1920,height:1080}},deviceScaleFactor:1,locale:'ko-KR',reducedMotion:'reduce'});
 const recordedAt=Date.now(),page=await context.newPage();
 const catalog=osmCatalog('영월',{elements:[{type:'node',id:1,lat:37.175,lon:128.465,tags:{name:'청령포',tourism:'attraction'}},{type:'node',id:2,lat:37.197,lon:128.452,tags:{name:'장릉',tourism:'attraction'}}]},new Date().toISOString());
 const trip={version:1,id:'guide-20261109',revision:0,basics:{...defaultBasics,title:'부모님과 함께하는 영월 여행',region:'영월',date:'2026-11-14',days:1,travelers:3,mode:'real',transport:'taxi',travelPriority:'comfort',travelHours:{start:600,end:1080}},conditions:{...defaultConditions,activity:'slow',restMin:20},catalog,history:[],feedback:[],items:[{id:'a',day:1,start:600,end:660,kind:'visit',placeId:catalog.places[0].id},{id:'b',day:1,start:660,end:680,kind:'rest',placeId:catalog.places[0].id},{id:'c',day:1,start:720,end:780,kind:'visit',placeId:catalog.places[1].id}].map(i=>({...i,fromId:null,toId:null,transport:null,locked:false,mode:'real'}))};
 await page.addInitScript(t=>localStorage.setItem('bopok:trip:v1',JSON.stringify(t)),trip);
 await page.route('**/api/place-details',r=>r.fulfill({json:{places:{}}}));
 await page.route('https://router.project-osrm.org/**',r=>r.abort());
 await page.route('**/api/evidence-read',async r=>{await new Promise(resolve=>setTimeout(resolve,700));return r.fulfill({json:{reading:{label:'영월 식사 예시',date:'2026-11-14',amount:30000,note:'기능 안내용 예시 · 제출 불가'}}});});
 await page.goto('/');await expect(page.getByRole('heading',{level:1})).toBeVisible();
 await page.addStyleTag({content:'html{scroll-behavior:smooth;zoom:1.15}nextjs-portal{display:none}body{padding-bottom:120px}#guide-label{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;background:#103f3af2;color:white;border:1px solid #ffffff30;border-radius:20px;padding:18px 32px;min-width:620px;box-shadow:0 12px 40px #0002;font-size:22px;pointer-events:none}#guide-label small{display:block;color:#a5e5d9;font-size:12px;letter-spacing:.14em;margin-bottom:7px}'});
 await page.evaluate(()=>{const el=document.createElement('div');el.id='guide-label';document.body.appendChild(el);});
 // The receipt is deliberately labeled as an example; never usable as a real claim.
 const receipt=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=700;c.height=900;const x=c.getContext('2d')!;x.fillStyle='#fff';x.fillRect(0,0,700,900);x.fillStyle='#143d35';x.font='bold 32px sans-serif';x.fillText('기능 안내용 예시 · 제출 불가',55,100);x.font='26px sans-serif';['영월 식사 예시','2026-11-14','식사 3인','합계 30,000원','실제 결제 영수증이 아닙니다.'].forEach((s,i)=>x.fillText(s,55,230+i*95));return c.toDataURL('image/png').split(',')[1];});
 const start=Date.now();writeFileSync(output+'/offset.json',JSON.stringify({offset:(start-recordedAt)/1000}));const chapters:{at:number;label:string;text:string}[]=[];
 async function label(label:string,text:string){chapters.push({at:(Date.now()-start)/1000,label,text});await page.evaluate(t=>{const e=document.querySelector('#guide-label')!;e.replaceChildren();const small=document.createElement('small');small.textContent='YEOHAENGIT  /  함께 떠나는 강원 여행';e.append(small,document.createTextNode(t));},text);}
 const pause=(ms=3500)=>page.waitForTimeout(ms);
 async function focus(selector:string){await page.locator(selector).first().evaluate(e=>e.scrollIntoView({behavior:'smooth',block:'center'}));await pause(900);}
 await page.locator('.simple-options > summary').click();await label('동행자 맞춤','함께 걷는 속도에 맞춰, 편안한 강원 여행');await focus('.comfort-choices');await pause();
 await page.getByRole('combobox',{name:'연속 보행 시간 한도',exact:true}).selectOption('15');await pause(1800);await page.getByRole('combobox',{name:'관광 후 휴식',exact:true}).selectOption('20');await pause(2200);
 await label('여행 조건','걷는 시간과 휴식, 여행할 지역을 직접 선택해요');await page.getByRole('combobox',{name:'여행 지역',exact:true}).selectOption('영월');await page.getByLabel('출발 날짜',{exact:true}).fill('2026-11-14');await focus('.simple-basics');await pause();
 await page.getByRole('button',{name:'이어서 보기',exact:true}).click();await expect(page.getByRole('heading',{name:trip.basics.title,exact:true})).toBeVisible();
 await label('나의 일정','저장한 일정에서 방문 순서와 휴식을 살펴보세요');await focus('.compact-stops');await pause(5000);
 await label('반값여행','여행 날짜에 맞는 지원 안내와 신청 조건을 확인해요');await focus('.half-price-travel');await pause(1800);await page.getByText('신청 전 확인할 조건',{exact:true}).click();await pause(3000);await page.getByText('신청 전 확인할 조건',{exact:true}).click();
 await page.getByText('선택한 일정으로 신청 글·서류 준비',{exact:true}).click();
 await label('신청 글 작성','선택한 일정이 신청 글 초안으로 정리돼요');await page.getByRole('textbox',{name:'신청 글 초안',exact:true}).evaluate(e=>e.scrollIntoView({behavior:'smooth',block:'center'}));await pause(5000);
 await label('증빙 보관','영수증을 올리고, AI가 읽은 내용을 확인하세요');await focus('.trip-evidence');const evidence=page.getByRole('region',{name:'영수증·방문사진 보관'});await evidence.getByRole('checkbox',{name:/업로드 후 AI로 자동 읽기/}).check();await pause(1000);await evidence.getByLabel('증빙 파일 선택',{exact:true}).setInputFiles({name:'기능안내_예시영수증.png',mimeType:'image/png',buffer:Buffer.from(receipt,'base64')});await expect(evidence.getByRole('textbox',{name:'결제처',exact:true})).toHaveValue('영월 식사 예시');await focus('.evidence-card');await pause(5000);
 await evidence.getByRole('checkbox',{name:'원본과 대조했으며 정산 초안에 반영합니다',exact:true}).check();await evidence.getByRole('button',{name:'내용 저장',exact:true}).click();await pause(1500);
 await label('정산 초안','확인한 결제 내역을 정산 글에 담고 저장하세요');await page.getByRole('combobox',{name:'작성할 문서',exact:true}).selectOption('settlement');const draft=page.getByRole('textbox',{name:'신청 글 초안',exact:true});await expect(draft).toHaveValue(/30,000원/);await draft.evaluate(e=>e.scrollIntoView({behavior:'smooth',block:'center'}));await pause(2200);await draft.evaluate(e=>{e.scrollTop=e.scrollHeight;});await pause(3300);
 await page.getByRole('button',{name:'텍스트 파일 저장',exact:true}).click();await pause(1500);
 await label('함께 떠나요','준비는 간편하게, 함께하는 시간은 여유롭게');await focus('.trip-share-actions');await pause(4500);
 await page.screenshot({path:output+'/final.png'});writeFileSync(output+'/chapters.json',JSON.stringify(chapters,null,2));const video=page.video()!;await context.close();await video.saveAs(output+'/guide.webm');
});
