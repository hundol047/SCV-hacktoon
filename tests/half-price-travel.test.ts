import {it,expect} from 'vitest';
import {halfPriceForRegion,halfPriceRounds,halfPriceState} from '../src/domain/half-price-travel';
it('matches Gangwon destinations, not similar venue names or Goseong in another province',()=>{
 expect(halfPriceForRegion('강원특별자치도 영월군 중앙로 1').map(p=>p.city)).toEqual(['영월']);
 expect(halfPriceForRegion('강원 고성군')).toEqual([]);
 expect(halfPriceForRegion('영월식당')).toEqual([]);
 expect(halfPriceForRegion('속초')).toEqual([]);
});
it('distinguishes a published window from closed, stale and out-of-range travel dates',()=>{
 const p=halfPriceRounds[0];
 expect(halfPriceState(p,'2026-11-10','2026-11-09')).toContain('잔여 접수 확인');
 expect(halfPriceState(p,'2026-11-08','2026-11-09')).toContain('지난 방문일');
 expect(halfPriceState(p,'2026-12-01','2026-11-09')).toContain('기간 밖');
 expect(halfPriceState(p,'2026-11-20','2026-11-18')).toContain('재확인');
 expect(halfPriceState(p,'2026-11-20','2026-11-23')).toContain('마감');
 expect(halfPriceState(halfPriceRounds[2],'2026-10-20','2026-11-09')).toContain('마감');
 expect(halfPriceState(p,'2026-02-30','2026-11-09')).toContain('날짜');
});

import {halfPriceDocuments} from '../src/domain/half-price-documents';
import {defaultBasics,defaultConditions,type Trip} from '../src/domain/schema';
import {osmCatalog} from '../src/adapters/real-data';
const catalog=osmCatalog('영월',{elements:[{type:'node',id:1,lat:37.18,lon:128.46,tags:{name:'일정 속 박물관',tourism:'museum'}}]},'2026-11-09T00:00:00Z');
const trip:Trip={version:1,id:'policy-doc',revision:0,basics:{...defaultBasics,title:'영월 여행',region:'영월',date:'2026-11-10',days:1,travelers:2,mode:'real',departureRegion:'비공개 상세 출발지'},conditions:defaultConditions,catalog,history:[],feedback:[],items:[{id:'visit',day:1,start:600,end:660,kind:'visit',placeId:catalog.places[0].id,fromId:null,toId:null,transport:null,locked:false,mode:'real'}]};
it('drafts use the selected itinerary but never invent receipts, identity or completed visits',()=>{
 const docs=halfPriceDocuments(trip,'영월');
 expect(docs.plan).toContain('2026-11-10');expect(docs.plan).toContain('10:00~11:00 일정 속 박물관');expect(docs.plan).toContain('2명');
 expect(docs.plan).not.toContain('비공개 상세 출발지');expect(docs.plan).toContain('[성명 입력]');
 expect(docs.settlement).toContain('[영수증 기준으로 입력]');expect(docs.settlement).not.toContain('일정 속 박물관');
 const changed=halfPriceDocuments({...trip,basics:{...trip.basics,date:'2026-11-12'}},'영월');expect(changed.plan).toContain('2026-11-12');
});
