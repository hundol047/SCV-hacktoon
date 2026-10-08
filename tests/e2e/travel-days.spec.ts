import {test,expect} from '@playwright/test';
import {defaultBasics,defaultConditions,type Item} from '../../src/domain/schema';
import {osmCatalog} from '../../src/adapters/real-data';
import AxeBuilder from '@axe-core/playwright';
test('a transfer-only day remains an unknown draft and displays its real-time record',async({page})=>{
 const catalog=osmCatalog('A · B',{elements:[{type:'node',id:501,lat:37.5,lon:127,tags:{name:'A 공원',leisure:'park'}},{type:'node',id:502,lat:37.6,lon:127,tags:{name:'B 공원',leisure:'park'}}]},new Date().toISOString());catalog.places=catalog.places.map((p,i)=>({...p,region:i?'B':'A'}));
 const basics={...defaultBasics,mode:'real' as const,region:catalog.region,days:3,destinations:[{region:'A',startDay:1,endDay:2,timezone:'Asia/Seoul',currency:'KRW'},{region:'B',startDay:3,endDay:3,timezone:'Asia/Seoul',currency:'KRW'}],transfers:[{fromRegion:'A',toRegion:'B',departure:'2026-10-17T17:00:00+09:00',arrival:'2026-10-19T08:00:00+09:00',mode:'rail' as const,source:'https://example.org/rail'}]};
 const items:Item[]=[1,3].map((day,i)=>({id:'visit'+day,day,start:540,end:600,kind:'visit',placeId:catalog.places[i].id,fromId:null,toId:null,transport:null,locked:false,mode:'real'}));
 await page.addInitScript(t=>localStorage.setItem('bopok:trip:v1',JSON.stringify(t)),{version:1,id:'travel-day-browser',revision:0,basics,conditions:defaultConditions,items,history:[],feedback:[],catalog});
 await page.goto('/');await page.getByRole('button',{name:'이어서 보기',exact:true}).click();await expect(page.getByText('2일차 일정이 없습니다.',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:/2일차/}).click();await expect(page.getByRole('heading',{name:'이동만 하는 날'})).toBeVisible();await expect(page.getByRole('link',{name:'시간표 출처 확인'})).toHaveAttribute('href','https://example.org/rail');
 await page.getByRole('button',{name:'부모님 모드',exact:true}).click();await expect(page.locator('.parent-sheet').getByRole('heading',{name:'이동만 하는 날'})).toBeVisible();
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
});
