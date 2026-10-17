import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const root=resolve('android/build/assets');
const server=createServer(async(req,res)=>{try{
  const path=resolve(root,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));
  if(!path.startsWith(root+'/'))throw Error();
  res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.gz':'application/gzip'})[extname(path)]??'text/plain');
  res.end(await readFile(path));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',headless:true});
try{
  const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.getByRole('button',{name:'우리 부모님 여행 만들기',exact:true}).click();
  await page.getByRole('button',{name:'다음으로',exact:true}).click();
  await page.getByRole('button',{name:'다음으로',exact:true}).click();
  await page.getByRole('button',{name:'이 조건으로 여행 준비하기'}).click();
  await page.getByLabel('데이터 모드').selectOption('real');
  await page.getByLabel('여행 기간').selectOption('1');
  await page.getByRole('button',{name:'전국 수집 자료 열기',exact:true}).click();
  await page.getByLabel('수집 자료 시·도').selectOption('KR-11');
  await page.getByLabel('수집 자료 검색어').fill('경복궁');
  await page.getByRole('button',{name:'전국 자료 검색',exact:true}).click();
  await page.getByRole('status').filter({hasText:'전국 보관 166,427건'}).waitFor({timeout:60000});
  await page.getByRole('button',{name:'이 지역 후보를 일정에 사용'}).click();
  const planner=page.locator('.taxi-planner');await planner.locator('summary').click();
  const boxes=planner.getByRole('group',{name:'택시 방문 장소 선택'}).getByRole('checkbox');
  await boxes.nth(0).check();await planner.getByRole('checkbox',{name:/관광 · 좌표 확인/}).first().check();
  await planner.getByRole('button',{name:'택시 이동 순서 계산'}).click();
  await planner.locator('.notice').waitFor();
  await page.getByRole('button',{name:'우리 가족 일정 만들기'}).click();
  await page.locator('.timeline').waitFor();
  const trip=await page.evaluate(()=>JSON.parse(localStorage.getItem('bopok:trip:v1')));
  assert.equal(trip.basics.taxiPlan.orderedPlaceIds.length,2);assert(trip.items.length>=3);
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'여행 JSON 내보내기'}).click();
  const download=await downloadEvent;assert(download.suggestedFilename().endsWith('.json'));
  await page.screenshot({path:'android/build/android-preview.png',fullPage:true});
  await page.reload();await page.getByRole('button',{name:'이어서 보기',exact:true}).click();await page.locator('.timeline').waitFor();
  // Exercise the Android bridge contract with a synthetic provider reply; no real API call.
  await page.addInitScript(()=>{
    window.BopokAndroid={aiStatus:()=>JSON.stringify({configured:true,model:'test-model'}),configureAI:()=>{},saveJson:()=>{},saveTourism:()=>{},printPage:()=>{},requestAI:(id,payload)=>{
      const request=JSON.parse(payload);
      setTimeout(()=>window.dispatchEvent(new CustomEvent('bopok:ai',{detail:{id,output:{candidateIds:[request.candidateIds[0]]}}})),20);
    }};
  });
  await page.reload();await page.getByRole('button',{name:'이어서 보기',exact:true}).click();
  await page.getByText('AI 대체 관광지 추천',{exact:true}).click();
  const selector=page.getByLabel('교체할 관광 일정');
  const selectedId=await selector.locator('option').nth(1).getAttribute('value');
  await selector.selectOption(selectedId);
  await page.getByRole('checkbox',{name:'여행 조건·후보의 외부 전송과 API 사용료에 동의합니다.'}).check();
  await page.getByRole('button',{name:'대체 관광지 AI 추천',exact:true}).click();
  await page.getByRole('button',{name:'이 관광지로 교체',exact:true}).click();
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('bopok:trip:v1')));
  assert.notEqual(after.items.find(i=>i.id===selectedId).placeId,trip.items.find(i=>i.id===selectedId).placeId);
  assert.equal(after.revision,trip.revision+1);assert(!after.basics.taxiPlan);
  assert.deepEqual(errors,[]);console.log('PASS: offline national search, taxi planning, local save/reload, JSON export; no page errors.');
  console.log('PASS: AI bridge contract with synthetic response, candidate validation and explicit replacement. Live AI and native keystore unverified.');
}finally{await browser.close();server.close();}
