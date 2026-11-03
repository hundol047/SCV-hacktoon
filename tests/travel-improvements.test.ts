import {expect,it} from 'vitest';
import {osmCatalog} from '../src/adapters/real-data';
import {defaultBasics} from '../src/domain/schema';
import {vehicleDayError} from '../src/domain/vehicle-day';
import {mapDirections} from '../src/domain/travel-links';
import {recordVenue} from '../src/domain/venue-facts';
import {weatherAllowed} from '../src/domain/weather';
const catalog=osmCatalog('서울',{elements:[{type:'node',id:1,lat:37.5,lon:127,tags:{name:'공원',leisure:'park'}},{type:'node',id:2,lat:37.6,lon:127.1,tags:{name:'전시관',tourism:'museum',indoor:'yes'}}]},new Date().toISOString());
const b={...defaultBasics,mode:'real' as const,region:'서울',days:2};
const ids=catalog.places.map(p=>p.id);
it('manual vehicle plans reject travel-only days, foreign regions and inappropriate weather',()=>{
  expect(vehicleDayError(b,catalog,1,ids)).toBeNull();
  expect(vehicleDayError(b,catalog,3,ids)).toContain('기간');
  expect(vehicleDayError({...b,travelDays:[2]},catalog,2,ids)).toContain('이동 전용');
  expect(vehicleDayError({...b,region:'부산'},catalog,1,ids)).toContain('지역');
  expect(vehicleDayError(b,catalog,1,['missing'])).toContain('지역');
  expect(vehicleDayError({...b,coursePreferences:[{day:1,weather:'storm',visitMinutes:60}]},catalog,1,ids)).toContain('중단');
  expect(vehicleDayError({...b,coursePreferences:[{day:1,weather:'rain',visitMinutes:60}]},catalog,1,ids)).toContain('야외');
  expect(vehicleDayError({...b,coursePreferences:[{day:1,weather:'rain',visitMinutes:60}]},catalog,1,[ids[1]])).toBeNull();
});
it('external directions contain only valid endpoints and an appropriate travel mode',()=>{
  for(const [mode,expected] of [['taxi','driving'],['driving','driving'],['walk','walking'],['transit','transit']]){
    const url=new URL(mapDirections(catalog.places[0],catalog.places[1],mode)!);
    expect(url.origin).toBe('https://www.google.com');
    expect(url.searchParams.get('origin')).toBe('37.5,127');
    expect(url.searchParams.get('destination')).toBe('37.6,127.1');
    expect(url.searchParams.get('travelmode')).toBe(expected);
  }
  expect(mapDirections({...catalog.places[0],latitude:undefined},catalog.places[1],'taxi')).toBeNull();
});
it('source-backed setting records affect weather filtering without silently overwriting old clients',()=>{
  const input={source:'https://example.org/info',at:new Date().toISOString(),walkMin:null,walkM:null,stairs:null,seat:null,cost:null,foods:null};
  const p=recordVenue(catalog.places[0],{...input,setting:'indoor'});
  expect(p.setting).toMatchObject({value:'indoor',checked:'user',source:input.source});
  expect(weatherAllowed(p,'rain')).toBe(true);
  expect(recordVenue(catalog.places[0],input).setting?.value).toBe('outdoor');
});
