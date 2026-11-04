import {expect,it} from 'vitest';
import {defaultBasics,defaultConditions,type Trip} from '../src/domain/schema';
import {osmCatalog} from '../src/adapters/real-data';
import {estimateDefaults,estimateTrip} from '../src/domain/trip-estimate';
const catalog=osmCatalog('서울',{elements:[{type:'node',id:1,lat:37.5,lon:127,tags:{name:'공원',tourism:'attraction'}}]},new Date().toISOString());
const trip:Trip={version:1,id:'estimate',revision:0,basics:{...defaultBasics,days:3,travelers:5,mode:'real',transport:'taxi',daySession:'morning'},conditions:defaultConditions,catalog,history:[],feedback:[],items:[{id:'visit',day:1,start:540,end:600,kind:'visit',placeId:catalog.places[0].id,fromId:null,toId:null,transport:null,locked:false,mode:'real'}]};
it('uses rooms and vehicles for groups, not per-person room or taxi prices',()=>{
 const r=estimateTrip(trip,{meal:10000,admission:5000,cafe:2000,room:80000,local:30000,roundTrip:40000});
 expect(r.rows.map(r=>r.amount)).toEqual([300000,25000,30000,480000,180000,200000]);expect(r.total).toBe(1215000);expect(r.perPerson).toBe(243000);
});
it('counts actual meals, respects free admission and excludes rest duplicates',()=>{
 const t=structuredClone(trip);t.basics.days=1;t.catalog!.places[0].cost.value=0;t.items.push({...t.items[0],id:'rest',kind:'rest'},{...t.items[0],id:'meal',kind:'meal'});
 const r=estimateTrip(t,{meal:10000,admission:5000,cafe:0,room:100000,local:0,roundTrip:0});expect(r.total).toBe(50000);expect(r.rows[3].amount).toBe(0);
});
it('does not propagate invalid input and distinguishes walking from taxi costs',()=>{
 const r=estimateTrip(trip,{meal:NaN,admission:-1,cafe:Infinity,room:-1,local:0,roundTrip:0});expect(r.total).toBe(0);expect(estimateDefaults({...trip,basics:{...trip.basics,transport:'walk'}}).local).toBe(0);
});
