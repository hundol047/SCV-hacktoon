import {expect,it,vi,beforeEach} from 'vitest';
import {defaultBasics,defaultConditions,type Trip} from '../src/domain/schema';
import {osmCatalog} from '../src/adapters/real-data';
import {optimizeTaxiOrder} from '../src/domain/taxi-plan';
vi.mock('../src/server/planning-quota',()=>({planningQuota:vi.fn()}));
vi.mock('../src/server/prepare-trip',()=>({prepareTrip:vi.fn()}));
import {prepareTrip} from '../src/server/prepare-trip';
import {POST} from '../src/app/api/edit-course/route';
const catalog=osmCatalog('강릉',{elements:[1,2,3].map(id=>({type:'node',id,lat:37.7+id/1000,lon:128.8,tags:{name:'장소'+id,tourism:'attraction'}}))},new Date().toISOString());
function fixture():Trip{const result=optimizeTaxiOrder(catalog.places,catalog.places.map(p=>p.id),catalog.places[0].id,1,null,null,undefined,{day:1,transport:'driving'});if('error'in result)throw Error(result.error);return {version:1,id:'edit-test',revision:0,basics:{...defaultBasics,region:'강릉',days:1,mode:'real',transport:'driving',travelHours:{start:540,end:1110},taxiPlan:result.plan},conditions:defaultConditions,catalog,history:[],feedback:[],items:[]};}
const req=(body:unknown)=>new Request('http://localhost/api/edit-course',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('BOPok_APP_URL','http://localhost');});
it('ordered user IDs are recalculated server-side while identity, feedback and undo remain',async()=>{
 const trip=fixture(),ids=catalog.places.map(p=>p.id).reverse();vi.mocked(prepareTrip).mockImplementation(async(b,c,cat)=>({...trip,basics:b,conditions:c,catalog:cat}));const r=await POST(req({trip,day:1,ids}));expect(r.status).toBe(200);const out=(await r.json()).trip;expect(out.basics.taxiPlan.orderedPlaceIds).toEqual(ids);expect(out.id).toBe(trip.id);expect(out.revision).toBe(1);expect(out.history).toHaveLength(1);
});
it('unknown, duplicate and locked edits do not call expensive route calculation',async()=>{
 const trip=fixture();for(const ids of [['missing'],[catalog.places[0].id,catalog.places[0].id]])expect((await POST(req({trip,day:1,ids}))).status).toBe(422);
 trip.items=[{id:'v',day:1,start:540,end:600,kind:'visit',placeId:catalog.places[0].id,fromId:null,toId:null,transport:null,locked:true,mode:'real'}];expect((await POST(req({trip,day:1,ids:[catalog.places[1].id]}))).status).toBe(422);expect(prepareTrip).not.toHaveBeenCalled();
});
it('recalculation failure returns error and does not alter submitted trip',async()=>{const trip=fixture(),before=JSON.stringify(trip);vi.mocked(prepareTrip).mockRejectedValue(Error('필수 시설 확인 필요'));const r=await POST(req({trip,day:1,ids:catalog.places.map(p=>p.id)}));expect(r.status).toBe(422);expect(JSON.stringify(trip)).toBe(before);});
