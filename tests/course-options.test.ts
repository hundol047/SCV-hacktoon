import {expect,it} from 'vitest';
import {osmCatalog} from '../src/adapters/real-data';
import {defaultBasics,defaultConditions,type Trip} from '../src/domain/schema';
import {regionalCourse} from '../src/domain/regional-course';
import {savePlan} from '../src/domain/course-plans';
import {dailyCourseOptions} from '../src/domain/course-options';
function fixture(size=14){
 const catalog=osmCatalog('강릉',{elements:Array.from({length:size},(_,i)=>({type:'node',id:i+1,lat:37.75+i*.001,lon:128.9,tags:{name:'관광지 '+i,tourism:'museum'}}))},new Date().toISOString());
 let basics={...defaultBasics,mode:'real' as const,region:'강릉',days:2,travelHours:{start:540,end:1110}};
 basics=savePlan(basics,regionalCourse(basics,defaultConditions,catalog,1,{candidateIds:catalog.places.slice(0,2).map(p=>p.id)}).plan) as typeof basics;
 basics=savePlan(basics,regionalCourse(basics,defaultConditions,catalog,2,{candidateIds:catalog.places.slice(2,4).map(p=>p.id)}).plan) as typeof basics;
 return {version:1,id:'options',revision:0,basics,conditions:defaultConditions,catalog,items:[],history:[],feedback:[]} as Trip;
}
it('offers three different attraction sets per day without borrowing other-day visits',()=>{
 const trip=fixture(),before=JSON.stringify(trip);
 for(const day of [1,2]){const options=dailyCourseOptions(trip,day);expect(options).toHaveLength(3);expect(new Set(options.map(o=>o.signature)).size).toBe(3);const other=trip.basics.coursePlans!.find(p=>p.day!==day)!.selectedPlaceIds;expect(options.flatMap(o=>o.ids).some(id=>other.includes(id))).toBe(false);}
 expect(JSON.stringify(trip)).toBe(before);
});
it('does not invent alternatives or relax required facilities',()=>{const trip=fixture(4);trip.basics.requiredFacilities=['wheelchair'];expect(dailyCourseOptions(trip,1)).toHaveLength(1);});
it('does not shorten a full-day course just to manufacture three alternatives',()=>{const trip=fixture(4);expect(dailyCourseOptions(trip,1)).toHaveLength(1);});
it('finds a third replacement combination when automatic filling converges on the same set',()=>{const options=dailyCourseOptions(fixture(5),1);expect(options).toHaveLength(3);expect(new Set(options.map(o=>o.signature)).size).toBe(3);});
it('Hongcheon is not capped to one course when enough valid candidates exist',()=>{const trip=fixture(60);trip.basics.region='홍천';trip.catalog!.region='홍천';trip.catalog!.places=trip.catalog!.places.map(p=>({...p,region:'홍천'}));expect(dailyCourseOptions(trip,1)).toHaveLength(3);expect(dailyCourseOptions(trip,2)).toHaveLength(3);});
