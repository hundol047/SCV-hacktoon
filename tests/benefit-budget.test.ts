import {it,expect} from 'vitest';
import {benefitSavings} from '../src/domain/benefit-budget';
import {defaultBasics,defaultConditions,type Trip} from '../src/domain/schema';
import {osmCatalog} from '../src/adapters/real-data';
import {lodgingLinks} from '../src/domain/lodging';
const catalog=osmCatalog('강원특별자치도',{elements:[{type:'node',id:1,lat:38.17,lon:128.49,tags:{name:'설악케이블카',tourism:'attraction'}}]},'2026-11-06T00:00:00Z');
const trip:Trip={version:1,id:'benefit',revision:0,basics:{...defaultBasics,region:'강원특별자치도',title:'속초 여행',date:'2026-11-20',days:1,travelers:3,mode:'real'},conditions:defaultConditions,catalog,items:[{id:'v',day:1,start:540,end:600,kind:'visit',placeId:catalog.places[0].id,fromId:null,toId:null,transport:null,locked:false,mode:'real'}],history:[],feedback:[]};
it('only discounts explicitly eligible people and hides expired discounts',()=>{expect(benefitSavings(trip,20000,{},'2026-11-06').saving).toBe(0);expect(benefitSavings(trip,20000,{'seorak-resident':1},'2026-11-06').saving).toBe(10000);expect(benefitSavings(trip,20000,{'seorak-resident':99},'2026-11-06').saving).toBe(30000);expect(benefitSavings(trip,20000,{'seorak-resident':3},'2027-01-01').saving).toBe(0);});
it('booking comparison carries dates, adults and rooms without inventing a price',()=>{const links=lodgingLinks('강릉 호텔','2026-11-20','2026-11-21',3,2);const url=new URL(links.booking);expect(url.searchParams.get('checkin')).toBe('2026-11-20');expect(url.searchParams.get('checkout')).toBe('2026-11-21');expect(url.searchParams.get('group_adults')).toBe('3');expect(url.searchParams.get('no_rooms')).toBe('2');});
