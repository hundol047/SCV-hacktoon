import {expect,it} from 'vitest';
import {gangwonDiscovery} from '../src/data/gangwon-discovery';
import {importPetRules,petAllowed,toolkitSchema,csvRows} from '../src/domain/travel-toolkit';
import {defaultBasics,defaultConditions,basicsSchema} from '../src/domain/schema';
import {rankVehiclePlaces} from '../src/domain/vehicle-recommendations';
import {osmCatalog} from '../src/adapters/real-data';
import {courseInput} from '../src/domain/regional-course';
const today=new Date().toISOString().slice(0,10);
it('18 Gangwon cities have at least eight unique named candidates',()=>{expect(Object.keys(gangwonDiscovery)).toHaveLength(18);for(const rows of Object.values(gangwonDiscovery)){expect(rows.length).toBeGreaterThanOrEqual(8);expect(new Set(rows).size).toBe(rows.length);}});
it('CSV handles BOM, quotes, commas and lines; future/ambiguous entries rejected',()=>{
 expect(csvRows('\uFEFFname,region\r\n"공원, 1","강릉"\r\n')).toEqual([['name','region'],['공원, 1','강릉']]);
 const csv=`name,region,allowed,conditions,source,checkedAt\n공원,강릉,true,"목줄, 이동장",https://example.org,${today}`;
 const rules=importPetRules(csv);expect(rules[0].conditions).toBe('목줄, 이동장');expect(petAllowed('공원','강원특별자치도 강릉시',rules)).toBe(true);
 expect(petAllowed('공원','강원특별자치도 속초시',rules)).toBe(false);expect(petAllowed('공원','강릉',[...rules,...rules])).toBe(false);
 expect(()=>importPetRules(csv.replace(today,'2099-01-01'))).toThrow();expect(()=>importPetRules(csv.replace(',true,',',가능,'))).toThrow();expect(()=>csvRows('"open')).toThrow();
});
it('pet permissions expire and missing evidence is excluded from candidate ranking',()=>{
 const c=osmCatalog('강릉',{elements:[1,2].map(id=>({type:'node',id,lat:37.7,lon:128.8,tags:{name:'공원'+id,tourism:'attraction'}}))},new Date().toISOString());
 const rules=importPetRules(`name,region,allowed,conditions,source,checkedAt\n공원1,강릉,true,목줄,https://example.org,${today}`);
 const b=basicsSchema.parse({...defaultBasics,mode:'real',region:'강릉',days:1,transport:'driving',travelHours:{start:540,end:1080},toolkit:toolkitSchema.parse({petRules:rules,petOnly:true})});
 expect(rankVehiclePlaces(c.places,b,defaultConditions).map(r=>r.place.name)).toEqual(['공원1']);
 expect(petAllowed('공원1','강릉',rules,Date.now()+31*86400000)).toBe(false);
 b.toolkit!.closures=[{placeId:c.places[0].id,status:'closed',message:'운휴',until:'2099-01-01',source:'https://example.org'}];
 expect(()=>courseInput(b,defaultConditions,c,1)).toThrow();
});
it('trip toolkit roundtrips notes, completed stops and evidence without treating user data as verified',()=>{
 const b=basicsSchema.parse({...defaultBasics,toolkit:{notes:{p:'쉬운 입구 이용'},completed:['v1'],petRules:[],petOnly:false,closures:[]}});
 expect(b.toolkit?.notes.p).toBe('쉬운 입구 이용');expect(()=>toolkitSchema.parse({notes:{x:'x'.repeat(1001)}})).toThrow();
});
