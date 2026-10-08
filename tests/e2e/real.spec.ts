import {test,expect} from '@playwright/test';
import {osmCatalog} from '../../src/adapters/real-data';
test('worldwide city lookup yields actual-place draft with unknown evidence and JSON backup',async({page})=>{
 const catalog=osmCatalog('프랑스 파리',{elements:[{type:'node',id:1,lat:48.86,lon:2.34,tags:{name:'자료의 박물관',tourism:'museum'}},{type:'node',id:2,lat:48.85,lon:2.35,tags:{name:'자료의 식당',amenity:'restaurant'}}]},new Date().toISOString());
 await page.route('**/api/catalog?*',route=>route.fulfill({json:catalog}));
 await page.goto('/');await page.getByRole('button',{name:'우리 부모님 여행 만들기',exact:true}).click();await page.getByRole('button',{name:'다음으로',exact:true}).click();await page.getByRole('button',{name:'다음으로',exact:true}).click();await page.getByRole('button',{name:'이 조건으로 여행 준비하기'}).click();
 await page.getByLabel('데이터 모드').selectOption('real');await page.getByLabel('도시와 국가').fill('프랑스 파리');await page.getByRole('button',{name:'실제 장소 조회',exact:true}).click();await expect(page.getByRole('status')).toContainText('2개 실제 장소');
 await page.getByRole('button',{name:'우리 가족 일정 만들기'}).click();await expect(page.getByRole('heading',{name:'정보 부족',exact:true})).toBeVisible();await expect(page.locator('.timeline')).toContainText('자료의 박물관');await expect(page.locator('.timeline')).toContainText('미확인');await expect(page.locator('.timeline')).not.toContainText('가상 솔바다');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'여행 JSON 내보내기'}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toMatch(/^bopok-.*\.json$/);
 const payload=await page.evaluate(()=>localStorage.getItem('bopok:trip:v1')!);await page.getByLabel('여행 JSON 파일').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(payload)});await expect(page.locator('.timeline')).toContainText('자료의 박물관');
 await page.getByRole('button',{name:'부모님 모드',exact:true}).click();await expect(page.locator('.parent-sheet')).toContainText('출발 전 미확인 시설');
});
