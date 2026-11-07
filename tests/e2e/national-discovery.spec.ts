import {test,expect} from '@playwright/test';
import {osmCatalog} from '../../src/adapters/real-data';
test('all provinces are selectable and district/food queries stay in selected province',async({page})=>{
 let requested='';const catalog=osmCatalog('제주특별자치도',{elements:[{type:'node',id:900,lat:33.25,lon:126.56,tags:{name:'서귀포 시험 식당',amenity:'restaurant'}}]},new Date().toISOString());
 await page.route('**/api/tourism?**',r=>{requested=r.request().url();return r.fulfill({json:catalog});});
 await page.goto('/');const section=page.getByRole('region',{name:'전국 지역 탐색'}),select=section.getByRole('combobox',{name:'여행할 시·도',exact:true});await expect(select.locator('option')).toHaveCount(17);
 for(const province of ['KR-11','KR-26','KR-41','KR-45','KR-49']){await select.selectOption(province);await expect(section.locator('article')).toHaveCount(8);}
 await section.getByLabel('시·군·구 또는 장소',{exact:true}).fill('서귀포시');await section.getByRole('checkbox',{name:'음식점·카페',exact:true}).check();await section.getByRole('button',{name:'선택 지역 장소 조회',exact:true}).click();await expect(section.getByRole('heading',{name:'서귀포 시험 식당'})).toBeVisible();const q=new URL(requested).searchParams;expect(q.get('province')).toBe('KR-49');expect(q.get('q')).toBe('서귀포시');
 await select.selectOption('KR-26');await expect(section.getByRole('heading',{name:'서귀포 시험 식당'})).toHaveCount(0);await expect(section.getByLabel('시·군·구 또는 장소',{exact:true})).toHaveValue('');
});
