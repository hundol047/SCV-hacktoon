import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {defaultBasics,defaultConditions,type Trip,type Item} from '../../src/domain/schema';
import {osmCatalog} from '../../src/adapters/real-data';
import {TransitProvider} from '../../src/adapters/transit';

const visit=(id:string,placeId:string,day=1):Item=>({id,placeId,day,start:540,end:570,kind:'visit',fromId:null,toId:null,transport:null,locked:false,mode:'real'});
const catalog=()=>{const c=osmCatalog('서울',{elements:[1,2,3].map(id=>({type:'node',id,lat:37.5+id/100,lon:127,tags:{name:'복원 장소 '+id,leisure:'park'}}))},new Date().toISOString());c.places=c.places.map(p=>({...p,region:'서울'}));return c;};
const realTrip=():Trip=>{const c=catalog();return {version:1,id:'integrity-browser',revision:0,basics:{...defaultBasics,title:'보존할 실제 여행',days:1,mode:'real',region:c.region},conditions:defaultConditions,items:[visit('current',c.places[0].id)],history:[],feedback:[],catalog:c};};
async function load(page:Page,trip:Trip){await page.addInitScript(t=>localStorage.setItem('bopok:trip:v1',JSON.stringify(t)),trip);await page.goto('/');await page.getByRole('button',{name:'이어서 보기',exact:true}).click();}

test('a downloaded trip larger than 512 KB imports with its complete undo history',async({page},info)=>{
 const trip=realTrip();trip.history=Array.from({length:5},()=>Array.from({length:1000},(_,n)=>visit('history-'+n,trip.catalog!.places[0].id)));await load(page,trip);
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'여행 JSON 내보내기',exact:true}).click();const download=await pending,path=info.outputPath('large-trip.json');await download.saveAs(path);expect((await readFile(path)).length).toBeGreaterThan(524288);
 await page.getByLabel('여행 JSON 파일').setInputFiles(path);await expect(page.getByRole('heading',{name:trip.basics.title,exact:true})).toBeVisible();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('bopok:trip:v1')!).history.length)).toBe(5);await expect(page.getByRole('alert').filter({hasText:'JSON'})).toHaveCount(0);
});
test('family links display transit timing and a transfer-only day accessibly',async({page})=>{
 const trip=realTrip(),c=trip.catalog!;c.places[2].region='부산';trip.basics.days=3;trip.basics.destinations=[{region:'서울',startDay:1,endDay:2,timezone:'Asia/Seoul',currency:'KRW'},{region:'부산',startDay:3,endDay:3,timezone:'Asia/Seoul',currency:'KRW'}];trip.basics.transfers=[{fromRegion:'서울',toRegion:'부산',departure:'2026-10-17T17:00:00+09:00',arrival:'2026-10-19T08:00:00+09:00',source:'https://example.org/train',mode:'rail'}];
 const route=await new TransitProvider('synthetic',async()=>Response.json({routes:[{duration:'901s',distanceMeters:3000}]})).route(c.places[0],c.places[1],'2026-10-17T00:40:00.000Z');c.routes=[route];trip.items=[visit('visit',c.places[0].id),{...visit('transit',''),placeId:null,kind:'move',start:580,end:600,fromId:c.places[0].id,toId:c.places[1].id,transport:'transit'},visit('arrival',c.places[2].id,3)];
 const id='00000000-0000-4000-8000-000000000099';await page.route('**/api/trips/'+id,r=>r.fulfill({json:{id,storageVersion:0,role:'viewer',trip}}));await page.goto('/family#trip='+id+'&token='+'x'.repeat(43));await expect(page.getByText('대중교통 이동해요. 예상 16분.',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'이동만 하는 날',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'시간표 출처 확인'}).first()).toHaveAttribute('href','https://example.org/train');expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
});
test('refreshing current map candidates keeps an earlier place available for undo',async({page})=>{
 const trip=realTrip();trip.history=[[visit('previous',trip.catalog!.places[1].id)]];const fresh={...trip.catalog!,places:[trip.catalog!.places[0]],routes:[]};await page.route('**/api/catalog',r=>r.fulfill({json:fresh}));await load(page,trip);await page.getByRole('button',{name:'실제 장소 자료 새로고침',exact:true}).click();await expect(page.getByText(/현재 일정과 되돌리기에 필요한 장소를 보존했습니다/)).toBeVisible();await page.getByRole('button',{name:'이전 일정으로 되돌리기',exact:true}).click();await expect(page.locator('.timeline')).toContainText('복원 장소 2');await expect(page.locator('.timeline')).not.toContainText('장소가 확인되지 않았습니다.');
});

async function holdCloudRead(page:Page,includeLink=false){
 await page.goto('/');await page.getByRole('button',{name:'예시 여행 체험하기',exact:true}).click();const created=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/trips');await page.getByRole('button',{name:'서버에 새 여행 저장',exact:true}).click();const remote=await (await created).json(),id=remote.id;await expect(page.getByRole('button',{name:'서버 변경 저장',exact:true})).toBeVisible();
 if(includeLink){await page.getByRole('button',{name:'부모님 확인 링크 만들기',exact:true}).click();await expect(page.getByLabel('가족에게 전달할 비공개 링크')).toBeVisible();}
 remote.trip.basics.title='늦은 응답이 덮어쓴 제목';let held=false,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/trips/'+id,async r=>{if(r.request().method()==='GET'&&!held){held=true;await gate;await r.fulfill({json:remote});}else await r.continue();});
 await page.getByRole('button',{name:'최신 서버 일정 불러오기',exact:true}).click();await expect.poll(()=>held).toBe(true);return release;
}
test('a delayed server read cannot overwrite a different trip opened while waiting',async({page})=>{
 const release=await holdCloudRead(page);try{const next=realTrip();next.id='new-local-trip';next.basics.title='새로 연 여행';await page.getByLabel('여행 JSON 파일').setInputFiles({name:'new.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(next))});await expect(page.getByRole('heading',{name:next.basics.title,exact:true})).toBeVisible();const arrived=page.waitForResponse(r=>r.request().method()==='GET'&&r.url().includes('/api/trips/'));release();await arrived;await expect(page.getByRole('button',{name:'서버에 새 여행 저장',exact:true})).toBeVisible();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('bopok:trip:v1')!).id)).toBe(next.id);await expect(page.getByRole('heading',{name:'늦은 응답이 덮어쓴 제목',exact:true})).toHaveCount(0);}finally{release();}
});
test('an identity change clears private links and ignores the previous session pending result',async({page})=>{
 await page.goto('/');await page.getByText('계정 로그인',{exact:true}).click();await page.getByLabel('로그인 이메일').fill('owner@test.invalid');await page.getByRole('button',{name:'이메일 확인 코드 받기',exact:true}).click();await page.getByLabel('이메일 확인 코드',{exact:true}).fill('000000');await page.getByRole('button',{name:'확인하고 로그인',exact:true}).click();await expect(page.getByText('owner@test.invalid 계정으로 로그인했습니다.')).toBeVisible();
 const release=await holdCloudRead(page,true);try{
 // The account cookie survives navigation; the old read remains in flight.
 await page.getByText('계정 로그인',{exact:true}).click();await page.getByRole('button',{name:'로그아웃',exact:true}).click();await expect(page.getByText('로그아웃했습니다.',{exact:true})).toBeVisible();await expect(page.getByLabel('가족에게 전달할 비공개 링크')).toHaveCount(0);const arrived=page.waitForResponse(r=>r.request().method()==='GET'&&r.url().includes('/api/trips/'));release();await arrived;await expect(page.getByRole('button',{name:'서버 변경 저장',exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:'늦은 응답이 덮어쓴 제목',exact:true})).toHaveCount(0);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('bopok:trip:v1')!).basics.title)).toBe('솔바다에서, 천천히 함께');
 }finally{release();}
});
