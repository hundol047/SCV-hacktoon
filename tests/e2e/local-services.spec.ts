import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('events register, filter, bookmark, persist and become a travel draft',async({page})=>{
  const start=new Date(Date.now()+86400000).toISOString().slice(0,10),end=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
  await page.goto('/');await page.getByText('지역 축제·문화행사 찾아보기',{exact:true}).click();
  const panel=page.locator('.local-events');await panel.getByText('출처가 있는 행사 직접 등록',{exact:true}).click();
  for(const [label,value] of [['행사명','검증용 지역 전시'],['등록 지역','서울'],['행사 주소','서울 종로구'],['행사 출처 HTTPS 주소','https://example.org/event'],['행사 위도 (선택)','37.5'],['행사 경도 (선택)','127']])await panel.getByLabel(label,{exact:true}).fill(value);
  await panel.getByLabel('등록 행사 유형').selectOption('culture');await panel.getByLabel('행사 시작일').fill(start);await panel.getByLabel('행사 종료일').fill(end);
  await panel.getByRole('button',{name:'행사 자료 저장',exact:true}).click();await expect(panel.getByRole('status')).toContainText('기기에 저장');
  await panel.getByLabel('행사 유형',{exact:true}).selectOption('festival');await expect(panel).toContainText('검색 결과 0건');await panel.getByLabel('행사 유형',{exact:true}).selectOption('culture');
  await panel.getByRole('button',{name:'즐겨찾기',exact:true}).click();await panel.getByRole('checkbox',{name:'즐겨찾기만 보기'}).check();await expect(panel).toContainText('검색 결과 1건');
  await page.reload();await page.getByText('지역 축제·문화행사 찾아보기',{exact:true}).click();await expect(panel.getByRole('button',{name:'즐겨찾기 해제',exact:true})).toBeVisible();
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await panel.getByText('행사 자료 불러오기·보관',{exact:true}).click();await panel.getByLabel('행사 JSON 가져오기').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":1,"events":[{}]}')});await expect(panel.getByRole('status')).toContainText('기존 자료는 유지');await expect(panel).toContainText('검색 결과 1건');
  await panel.getByRole('button',{name:'이 행사로 여행 시작',exact:true}).click();await expect(page.locator('.timeline')).toContainText('검증용 지역 전시');
  const trip=await page.evaluate(()=>JSON.parse(localStorage.getItem('bopok:trip:v1')!));expect(trip.basics.date).toBe(start);expect(trip.catalog.places[0].hours.value).toBeNull();
});
test('promotion drafts require facts and review, save locally and accept a validated AI response',async({page})=>{
  await page.goto('/');await page.getByText('소상공인 홍보 콘텐츠 만들기',{exact:true}).click();const panel=page.locator('.promotion-studio');
  await panel.getByRole('button',{name:'API 키 없이 기본 홍보 초안 만들기',exact:true}).click();await expect(panel.getByRole('status')).toContainText('입력');
  for(const [label,value] of [['상호명','테스트 카페'],['가게 지역','강릉'],['업종·대표 상품','커피'],['확인된 상품·서비스 사실','오전 10시부터 커피를 판매합니다.']])await panel.getByLabel(label,{exact:true}).fill(value);
  await panel.getByRole('button',{name:'API 키 없이 기본 홍보 초안 만들기',exact:true}).click();await expect(panel.locator('.promotion-preview')).toContainText('AI 미사용');await expect(panel.getByLabel('홍보 초안 편집')).toContainText('오전 10시');
  await expect(panel.getByRole('button',{name:'검토한 홍보 문구 복사',exact:true})).toBeDisabled();await panel.getByRole('checkbox',{name:'가격·기간·혜택·표현을 직접 확인했습니다.'}).check();await expect(panel.getByRole('button',{name:'검토한 홍보 문구 복사',exact:true})).toBeEnabled();
  await panel.getByRole('button',{name:'홍보 초안 기기에 저장',exact:true}).click();await page.reload();await page.getByText('소상공인 홍보 콘텐츠 만들기',{exact:true}).click();await panel.getByRole('button',{name:'저장한 홍보 초안 불러오기',exact:true}).click();await expect(panel.getByLabel('상호명')).toHaveValue('테스트 카페');await expect(panel.getByRole('button',{name:'검토한 홍보 문구 복사',exact:true})).toBeDisabled();
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.route('**/api/promotions',r=>r.fulfill({json:{headline:'강릉 테스트 카페',body:'오전 10시부터 커피를 판매합니다.',hashtags:['#강릉']}}));await panel.getByRole('checkbox',{name:'사업 정보의 OpenAI 전송과 API 사용료에 동의합니다.'}).check();await panel.getByRole('button',{name:'AI 홍보 초안 만들기',exact:true}).click();await expect(panel.getByRole('heading',{name:'AI 생성 초안',exact:true})).toBeVisible();
  await panel.getByLabel('홍보 초안 편집').fill('직접 수정한 홍보 문구');await expect(panel.getByRole('button',{name:'검토한 홍보 문구 복사',exact:true})).toBeDisabled();
  await panel.getByRole('button',{name:'저장한 홍보 초안 삭제',exact:true}).click();expect(await page.evaluate(()=>localStorage.getItem('bopok:promotion:v1'))).toBeNull();
});
