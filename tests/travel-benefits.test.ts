import {expect,it} from 'vitest';
import {defaultBasics,defaultConditions,type Trip} from '../src/domain/schema';
import {osmCatalog} from '../src/adapters/real-data';
import {benefitRegions,koreaToday,selectBenefits} from '../src/domain/travel-benefits';
import {benefitAreas,residentAreas,travelBenefits} from '../src/data/travel-benefits';
const catalog=osmCatalog('강원특별자치도',{elements:[{type:'node',id:1,lat:38.17,lon:128.49,tags:{name:'설악케이블카',tourism:'attraction'}}]},'2026-11-06T00:00:00Z');
const trip:Trip={version:1,id:'benefits',revision:0,basics:{...defaultBasics,title:'속초 여행',region:'강원특별자치도',date:'2026-11-20',days:2,mode:'real',departureRegion:'서울'},conditions:defaultConditions,catalog,history:[],feedback:[],items:[{id:'v',kind:'visit',placeId:catalog.places[0].id,day:1,start:540,end:600,locked:false,fromId:null,toId:null,transport:null,mode:'real'}]};
const ids=(t=trip,day=1,override='',now='2026-11-06')=>selectBenefits(t,day,override,now).map(b=>b.id);
it('uses destination rather than departure and marks an actual scheduled venue',()=>{
 expect(ids()).toContain('seorak-resident');expect(ids({...trip,basics:{...trip.basics,title:'강원 여행'}})).toContain('seorak-resident');expect(ids()).not.toContain('seoul-foreign');expect(ids()).not.toContain('resident-강원');expect(selectBenefits(trip,1,'','2026-11-06')[0]).toMatchObject({id:'seorak-resident',inItinerary:true,audience:'resident'});
});
it('expires dated discounts and old reviewed specific benefits',()=>{
 const december={...trip,basics:{...trip.basics,date:'2026-12-01'}};expect(ids(december)).not.toContain('sokcho-yoga');expect(ids(trip,1,'','2026-12-07')).not.toContain('seorak-resident');expect(ids(trip,1,'','2026-12-07')).toContain('month-gangwon');
});
it('checks the selected day rather than the trip start and supports regional browsing',()=>{
 const t={...trip,basics:{...trip.basics,date:'2026-11-30'}};expect(ids(t,1)).toContain('sokcho-yoga');expect(ids(t,2)).not.toContain('sokcho-yoga');expect(ids(trip,1,'제주')).toContain('jeju-tamnao');expect(ids(trip,1,'제주')).not.toContain('seorak-resident');
});
it('shows digital resident programs only for participating cities, not a whole province by default',()=>{
 expect(ids({...trip,basics:{...trip.basics,title:'정선 여행'}})).toContain('resident-강원');expect(ids({...trip,basics:{...trip.basics,title:'속초 여행'}})).not.toContain('resident-강원');
});
it('does not recommend Korean discounts for overseas holidays and handles destination dates',()=>{
 const foreign={...trip,basics:{...trip.basics,timezone:'Asia/Tokyo',region:'도쿄',title:'도쿄 여행'}};expect(ids(foreign)).toEqual([]);
 const multi={...trip,basics:{...trip.basics,destinations:[{region:'제주특별자치도',startDay:1,endDay:2,timezone:'Asia/Seoul',currency:'KRW'}]}};
 expect(ids(multi)).toContain('jeju-pass');expect(ids(multi)).not.toContain('seorak-resident');expect(ids(multi)).not.toContain('month-gangwon');
});
it('covers 17 domestic regions with reviewed official directories and safe unique links',()=>{
 expect(new Set(benefitAreas.flatMap(a=>a.regions)).size).toBe(17);expect(new Set(travelBenefits.map(b=>b.id)).size).toBe(travelBenefits.length);
 for(const b of travelBenefits){expect(new URL(b.url).protocol).toBe('https:');expect(b.conditions.length).toBeGreaterThan(5);}
 expect(Object.values(residentAreas).flat().length).toBe(52);
 expect(benefitRegions('경기도 광주시')).toEqual(['경기']);expect(benefitRegions('광주광역시')).toEqual(['광주']);
 expect(koreaToday(Date.parse('2026-11-05T15:01:00Z'))).toBe('2026-11-06');
});
