import {test,expect} from '@playwright/test';
import {osmCatalog} from '../../src/adapters/real-data';
import AxeBuilder from '@axe-core/playwright';
const catalog=osmCatalog('속초',{elements:[1,2,3].map(id=>({type:'node',id,lat:38.2,lon:128.6+id/1000,tags:{name:'여행지 '+id,tourism:'museum'}}))},new Date().toISOString());
test('Gangwon destination selection retains AI payload and accessible mobile form',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/tourism?**',r=>{const u=new URL(r.request().url());expect(u.searchParams.get('province')).toBe('KR-42');expect(u.searchParams.get('q')).toBe('속초');return r.fulfill({json:catalog});});
 await page.route('**/api/location',r=>r.fulfill({json:{locations:[{id:'origin',name:'서울역',address:'서울역',latitude:37.55,longitude:126.97}]}}));
 await page.route('**/api/departure-hubs',r=>r.fulfill({json:{hubs:[]}}));
 let payload:any;
 await page.route('**/api/courses',r=>{payload=r.request().postDataJSON();return r.fulfill({status:503,json:{error:'테스트: AI 요청 계약 확인 완료'}});});
 await page.goto('/');await expect(page.getByRole('heading',{level:1})).toContainText('편안한 강원 여행');await expect(page.locator('.simple-trip input:visible, .simple-trip select:visible, .simple-trip textarea:visible')).toHaveCount(4);await expect(page.locator('.simple-options')).not.toHaveAttribute('open','');
 await expect(page.getByRole('combobox',{name:'여행 지역',exact:true}).locator('option')).toHaveCount(18);
 await page.getByRole('combobox',{name:'여행 지역',exact:true}).selectOption('속초');await expect(page.getByRole('combobox',{name:'여행 지역',exact:true})).toHaveValue('속초');
 await page.getByLabel('출발 지역',{exact:true}).fill('서울역');await page.getByRole('combobox',{name:'여행 기간',exact:true}).selectOption('2');
 await page.locator('.simple-options > summary').click();await expect(page.locator('.simple-options')).toHaveAttribute('open','');await page.getByRole('button',{name:'바다 보기',exact:true}).click();
 await page.getByText('예산·출발·귀가 조건',{exact:true}).click();await page.getByLabel('여행 전체 예산 (원)',{exact:true}).fill('300000');
 await page.getByRole('button',{name:'지역 검색하고 AI 일정 생성'}).click();await expect(page.locator('.simple-trip').getByRole('alert')).toHaveText('테스트: AI 요청 계약 확인 완료');
 expect(payload.basics.days).toBe(2);expect(payload.basics.title).toBe('속초 여행');expect(payload.basics.departureCoordinates).toEqual({latitude:37.55,longitude:126.97});expect(payload.basics.tripBudget).toBe(300000);expect(payload.conditions.experiences).toContain('바다 보기');expect(payload.basics.travelPriority).toBe('comfort');expect(payload.conditions.activity).toBe('slow');expect(payload.conditions.restMin).toBe(20);expect(payload.allDays).toBe(true);expect(payload.consent).toBe(true);
 await page.getByText('예산·출발·귀가 조건',{exact:true}).click();await page.getByText('예산·출발·귀가 조건',{exact:true}).click();await expect(page.getByLabel('여행 전체 예산 (원)',{exact:true})).toHaveValue('300000');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations).toEqual([]);expect(errors).toEqual([]);
 await page.screenshot({path:info.outputPath('gangwon-home.png'),fullPage:true});
});

test('half-price support follows destination and date without promising a refund',async({page})=>{
 await page.goto('/');await page.getByRole('combobox',{name:'여행 지역',exact:true}).selectOption('영월');await page.getByLabel('출발 날짜',{exact:true}).fill('2026-11-10');
 await page.locator('.simple-options > summary').click();
 const policy=page.getByRole('complementary',{name:'정부 반값여행 지원'});
 await expect(policy).toContainText('영월 반값여행');await expect(policy).toContainText('2026-11-07 ~ 2026-11-22');
 await expect(policy.getByRole('link')).toHaveAttribute('href','https://korean.visitkorea.or.kr/dgtourcard/tour50.do');
 await policy.getByText('신청 전 확인할 조건',{exact:true}).click();await expect(policy).toContainText('현재 예상 여행비에는 차감하지 않아요');
 await page.getByRole('combobox',{name:'여행 지역',exact:true}).selectOption('평창');await expect(policy).toContainText('마감');
 await page.getByRole('combobox',{name:'여행 지역',exact:true}).selectOption('고성');await expect(policy).toHaveCount(0);
});

test('selected itinerary creates editable policy drafts and downloads text',async({page})=>{
 const {defaultBasics,defaultConditions}=await import('../../src/domain/schema');
 const places=osmCatalog('영월',{elements:[{type:'node',id:1,lat:37.18,lon:128.46,tags:{name:'일정 속 박물관',tourism:'museum'}}]},new Date().toISOString());
 const trip={version:1,id:'documents',revision:0,basics:{...defaultBasics,title:'영월 여행',region:'영월',date:'2026-11-10',days:1,travelers:2,mode:'real'},conditions:defaultConditions,catalog:places,history:[],feedback:[],items:[{id:'visit',day:1,start:600,end:660,kind:'visit',placeId:places.places[0].id,fromId:null,toId:null,transport:null,locked:false,mode:'real'}]};
 await page.addInitScript(t=>localStorage.setItem('bopok:trip:v1',JSON.stringify(t)),trip);
 await page.route('**/api/place-details',r=>r.fulfill({json:{places:{}}}));
 await page.goto('/');await page.getByRole('button',{name:'이어서 보기',exact:true}).click();
 await page.getByText('선택한 일정으로 신청 글·서류 준비',{exact:true}).click();
 const draft=page.getByRole('textbox',{name:'신청 글 초안',exact:true});await expect(draft).toContainText('일정 속 박물관');await expect(draft).toContainText('2026-11-10');
 await draft.fill('직접 수정한 여행계획');const download=page.waitForEvent('download');await page.getByRole('button',{name:'텍스트 파일 저장',exact:true}).click();expect((await download).suggestedFilename()).toContain('영월');
 await page.getByRole('button',{name:'현재 일정으로 다시 채우기',exact:true}).click();await expect(draft).toContainText('일정 속 박물관');
 await page.getByRole('combobox',{name:'작성할 문서',exact:true}).selectOption('settlement');await expect(draft).toContainText('[영수증 기준으로 입력]');expect(await draft.inputValue()).not.toContain('일정 속 박물관');
 let scans=0;await page.route('**/api/evidence-read',r=>{scans++;expect(r.request().postDataJSON().consent).toBe(true);return r.fulfill({json:{reading:{label:'영월 테스트 식당',date:'2026-11-10',amount:30000,note:'합계 확인'}}});});
 const evidence=page.getByRole('region',{name:'영수증·방문사진 보관'});
 await evidence.getByRole('checkbox',{name:/업로드 후 AI로 자동 읽기/}).check();
 const file={name:'receipt.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')};
 await evidence.getByLabel('증빙 파일 선택',{exact:true}).setInputFiles(file);
 await expect(evidence.getByRole('textbox',{name:'결제처',exact:true})).toHaveValue('영월 테스트 식당');
 expect(await draft.inputValue()).not.toContain('영월 테스트 식당');
 await evidence.getByRole('checkbox',{name:'원본과 대조했으며 정산 초안에 반영합니다',exact:true}).check();await evidence.getByRole('button',{name:'내용 저장',exact:true}).click();
 await expect(draft).toHaveValue(/30,000원/);await expect(draft).toHaveValue(/영월 테스트 식당/);
 await evidence.getByLabel('증빙 파일 선택',{exact:true}).setInputFiles(file);await expect(evidence).toContainText('같은 원본이 이미 저장');expect(scans).toBe(1);
 await page.reload();await page.getByRole('button',{name:'이어서 보기',exact:true}).click();await page.getByText('선택한 일정으로 신청 글·서류 준비',{exact:true}).click();await page.getByRole('combobox',{name:'작성할 문서',exact:true}).selectOption('settlement');
 await expect(draft).toHaveValue(/30,000원/);await expect(evidence.getByRole('link',{name:'원본 내려받기'})).toHaveAttribute('download','receipt.png');
 await evidence.getByRole('button',{name:'증빙 삭제',exact:true}).click();await expect(evidence.locator('.evidence-card')).toHaveCount(0);await expect(draft).not.toHaveValue(/30,000원/);

});

test('comfort route report persists and evidence backup restores without auto-confirmation',async({page},info)=>{
 const {defaultBasics,defaultConditions}=await import('../../src/domain/schema');
 const places=osmCatalog('영월',{elements:[{type:'node',id:991,lat:37.18,lon:128.46,tags:{name:'확인할 방문지',tourism:'museum'}}]},new Date().toISOString());
 const trip={version:1,id:'comfort-browser',revision:0,basics:{...defaultBasics,title:'영월 동행 여행',region:'영월',date:'2026-11-10',days:1,travelers:2,mode:'real'},conditions:defaultConditions,catalog:places,history:[],feedback:[],items:[{id:'visit',day:1,start:600,end:660,kind:'visit',placeId:places.places[0].id,fromId:null,toId:null,transport:null,locked:false,mode:'real'}]};
 await page.addInitScript(t=>{if(!localStorage.getItem('bopok:trip:v1'))localStorage.setItem('bopok:trip:v1',JSON.stringify(t));},trip);
 await page.route('**/api/place-details',r=>r.fulfill({json:{places:{}}}));
 await page.goto('/');await page.getByRole('button',{name:'이어서 보기',exact:true}).click();
 await page.getByText('이 일정이 동행자에게 맞는지 확인',{exact:true}).click();
 await page.getByLabel('확인 날짜',{exact:true}).fill(new Date().toISOString().slice(0,10));
 await page.getByLabel('구간 이동 시간 (분)',{exact:true}).fill('8');
 await page.getByLabel('계단·경사·노면·쉴 곳·확인 내용',{exact:true}).fill('하차장부터 입구까지 자갈길, 벤치 1곳.');
 await page.getByRole('button',{name:'동선 확인 기록 저장',exact:true}).click();await expect(page.locator('.comfort-review')).toContainText('직접 방문 기록');
 await page.reload();await page.getByRole('button',{name:'이어서 보기',exact:true}).click();await page.getByText('이 일정이 동행자에게 맞는지 확인',{exact:true}).click();await expect(page.locator('.comfort-review')).toContainText('자갈길');
 await page.getByText('선택한 일정으로 신청 글·서류 준비',{exact:true}).click();
 const evidence=page.getByRole('region',{name:'영수증·방문사진 보관'});
 await evidence.getByLabel('증빙 파일 선택',{exact:true}).setInputFiles({name:'receipt.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')});
 await expect(evidence.locator('.evidence-card')).toHaveCount(1);await evidence.getByLabel('결제처',{exact:true}).fill('보관 식당');await evidence.getByLabel('실제 날짜',{exact:true}).fill('2026-11-10');await evidence.getByLabel('실제 결제액 (원)',{exact:true}).fill('30000');await evidence.getByRole('checkbox',{name:'원본과 대조했으며 정산 초안에 반영합니다',exact:true}).check();await evidence.getByRole('button',{name:'내용 저장',exact:true}).click();
 await page.getByText('증빙·초안 암호화 백업 및 복원',{exact:true}).click();await page.getByLabel('백업 암호 (12자 이상)',{exact:true}).fill('browser-test-password');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'암호화 백업 내려받기',exact:true}).click();const file=await download;const path=info.outputPath('evidence.enc.json');await file.saveAs(path);
 await evidence.getByRole('button',{name:'증빙 삭제',exact:true}).click();await expect(evidence.locator('.evidence-card')).toHaveCount(0);
 await page.getByLabel('암호화 백업 파일 복원',{exact:true}).setInputFiles(path);await expect(evidence.getByLabel('결제처',{exact:true})).toHaveValue('보관 식당');await expect(evidence.getByRole('checkbox',{name:'원본과 대조했으며 정산 초안에 반영합니다',exact:true})).not.toBeChecked();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const bundleEvent=page.waitForEvent('download');await page.getByRole('button',{name:'제출 검토용 파일 묶음 내려받기',exact:true}).click();const bundle=await bundleEvent;expect(bundle.suggestedFilename()).toContain('.zip');await bundle.saveAs(info.outputPath('submission.zip'));
 await page.locator('.evidence-backup').screenshot({path:info.outputPath('comfort-proof.png')});
});

test('voice input applies fields and explicit command generates only once',async({page})=>{
 await page.addInitScript(()=>{class Recognition{lang='';continuous=false;interimResults=false;onresult:any;onerror:any;onend:any;start(){(window as any).testRecognition=this;}abort(){this.onend?.();}}(window as any).SpeechRecognition=Recognition;});
 let requests=0;let payload:any;
 await page.route('**/api/location',r=>r.fulfill({json:{locations:[{id:'origin',name:'판교역',address:'성남시 분당구',latitude:37.39,longitude:127.11}]}}));
 await page.route('**/api/tourism?**',r=>r.fulfill({json:catalog}));
 await page.route('**/api/courses',r=>{requests++;payload=r.request().postDataJSON();return r.fulfill({status:503,json:{error:'음성 생성 요청 확인'}});});
 await page.goto('/');await expect(page.locator('.simple-trip input:visible, .simple-trip select:visible')).toHaveCount(4);
 await page.getByRole('button',{name:'음성으로 입력',exact:true}).click();
 await page.evaluate(()=>{const r=(window as any).testRecognition;r.onresult({results:[[{transcript:'판교역에서 내일 속초로 1박 2일 일정 만들어 줘'}]]});r.onresult({results:[[{transcript:'일정 만들어 줘'}]]});r.onend();});
 await expect(page.locator('.simple-trip').getByRole('alert')).toHaveText('음성 생성 요청 확인');expect(requests).toBe(1);expect(payload.basics.departureRegion).toBe('판교역');expect(payload.basics.days).toBe(2);expect(payload.basics.title).toBe('속초 여행');
 await page.getByRole('button',{name:'음성으로 입력',exact:true}).click();await page.evaluate(()=>{const r=(window as any).testRecognition;r.onresult({results:[[{transcript:'여행지는 영월'}]]});r.onend();});await expect(page.getByRole('combobox',{name:'여행 지역',exact:true})).toHaveValue('영월');expect(requests).toBe(1);
 await page.getByRole('button',{name:'음성으로 입력',exact:true}).click();await page.getByRole('button',{name:'음성 입력 중지',exact:true}).click();await page.evaluate(()=>{(window as any).testRecognition.onresult({results:[[{transcript:'일정 만들어 줘'}]]});});expect(requests).toBe(1);
});
