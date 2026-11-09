import {it,expect} from 'vitest';
import {osmCatalog} from '../src/adapters/real-data';
import {defaultBasics,defaultConditions} from '../src/domain/schema';
import {arrangeCustomCourse} from '../src/domain/custom-course';
const catalog=osmCatalog('강릉',{elements:[1,2,3].map(id=>({type:'node',id,lat:37.75+id/1000,lon:128.9,tags:{name:'관광지 '+id,tourism:'attraction'}}))},new Date().toISOString());
for(const [i,a] of catalog.places.entries())for(const [j,b] of catalog.places.entries()){if(i===j)continue;const fact={value:i+j===1?20:2,evidenceId:'road',source:'https://router.project-osrm.org',nature:'real' as const,checked:'source' as const,collectedAt:new Date().toISOString()};catalog.routes.push({id:`r:${a.id}:${b.id}:taxi`,fromId:a.id,toId:b.id,transport:'taxi',duration:fact,walkMin:{...fact,value:0},walkM:{...fact,value:0},cost:{...fact,value:null},stairs:{...fact,value:null},mode:'real'});}
const basics={...defaultBasics,mode:'real' as const,region:'강릉',transport:'taxi' as const,travelHours:{start:540,end:1200}};
it('uses real road minutes to arrange all selected places without discarding a stop',()=>{const rows=arrangeCustomCourse(catalog.places,basics,{...defaultConditions,restMin:20},catalog,1);expect(rows.filter(i=>i.kind==='move').reduce((n,i)=>n+i.end-i.start,0)).toBe(4);expect(new Set(rows.filter(i=>i.kind==='visit').map(i=>i.placeId))).toEqual(new Set(catalog.places.map(p=>p.id)));});
it('does not silently drop selected places when they cannot fit',()=>{expect(()=>arrangeCustomCourse(catalog.places,{...basics,travelHours:{start:540,end:570}},defaultConditions,catalog,1)).toThrow('모두 방문');});
it('does not invent road times for disconnected selections',()=>{expect(()=>arrangeCustomCourse(catalog.places,basics,defaultConditions,{...catalog,routes:[]},1)).toThrow('모두 방문');});
