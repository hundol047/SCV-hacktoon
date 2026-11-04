import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {courseInput} from '../../src/domain/regional-course';
test('APK web assets search the bundled dataset and route AI to the server bridge',async({page})=>{
 let calls=0;
 await page.exposeFunction('syntheticServer',async(path:string,body:string)=>{
  if(path==='/api/location')return {locations:[{id:'1',name:'서울',address:'서울특별시',latitude:37.56,longitude:126.97}]};
  if(path==='/api/place-details')return {places:{}};
  expect(path).toBe('/api/courses');const data=JSON.parse(body);expect(data.consent).toBe(true);expect(data.basics.region).toContain('서울');
  const candidates=courseInput(data.basics,data.conditions,data.catalog,data.day).candidates;calls++;return {candidateIds:candidates.slice(0,3).map(p=>p.place.id)};
 });
 await page.addInitScript(()=>{(window as any).BopokAndroid={requestServer:async(id:string,path:string,body:string)=>{const data=await (window as any).syntheticServer(path,body);window.dispatchEvent(new CustomEvent('bopok:server',{detail:{id,status:200,data}}));},printPage:()=>{},saveJson:()=>{},saveTourism:()=>{}};});
 await page.route('http://localhost:4173/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  try{const body=await readFile('android/build/assets'+(path==='/'?'/index.html':path));const type=path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':path.endsWith('.gz')?'application/gzip':path.endsWith('.jpg')?'image/jpeg':'text/html';await route.fulfill({body,contentType:type});}catch{await route.fulfill({status:404});}
 });
 await page.goto('http://localhost:4173/');await page.getByRole('button',{name:'지역 맞춤 여행 시작'}).click();
 const form=page.getByRole('region',{name:'간편 AI 일정 입력'});await expect(form.locator('input,select')).toHaveCount(7);
 await form.getByLabel('출발 지역',{exact:true}).fill('서울');await form.getByLabel('여행 지역',{exact:true}).fill('서울 종로구');await form.getByRole('button',{name:'지역 검색하고 AI 일정 생성'}).click();
 await expect(page.getByRole('heading',{name:'서울 종로구 여행',exact:true})).toBeVisible({timeout:20000});expect(calls).toBe(1);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('bopok:trip:v1')!).catalog.places.length)).toBeGreaterThan(2);
});
