import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {forecastFresh,forecastURL,forecastWeather,parseForecast} from '../src/domain/live-weather';
import {parseRoadRoute,roadURL,roadFact} from '../src/domain/road-route';
import {osmCatalog} from '../src/adapters/real-data';
import {routeSchema} from '../src/data/catalog';
const catalog=osmCatalog('서울',{elements:[{type:'node',id:1,lat:37.554704,lon:126.972512,tags:{name:'서울역',tourism:'attraction'}},{type:'node',id:2,lat:37.567005,lon:126.977893,tags:{name:'도착지',tourism:'attraction'}}]},new Date().toISOString());
const [from,to]=catalog.places;
const weather={timezone:'Asia/Seoul',daily:{time:['2030-01-01'],weather_code:[61],temperature_2m_max:[23],temperature_2m_min:[17],precipitation_probability_max:[80],wind_speed_10m_max:[20]},current:{temperature_2m:20,time:'2030-01-01T10:00'}};
it('forecast date, null and invalid values cannot masquerade as usable weather',()=>{
  const f=parseForecast(weather,'2030-01-01',37.5,127);expect(forecastWeather(f)).toBe('rain');expect(forecastFresh(f,f.date)).toBe(true);
  expect(forecastFresh(f,'2030-01-02')).toBe(false);expect(forecastFresh(f,f.date,Date.parse(f.fetchedAt)+7200000)).toBe(false);expect(forecastFresh(f,f.date,Date.parse(f.fetchedAt)-1000)).toBe(false);
  expect(()=>parseForecast(weather,'2030-02-01',37.5,127)).toThrow('예보가 없습니다');
  expect(()=>parseForecast({...weather,daily:{...weather.daily,temperature_2m_max:[null]}},'2030-01-01',37.5,127)).toThrow();
  expect(()=>forecastURL(NaN,127)).toThrow();expect(new URL(forecastURL(37.5,127)).searchParams.get('timezone')).toBe('auto');
});
it('weather classifies snow/thunder/wind/heat/cold and never calls fog or clouds sunny',()=>{
  const f={...parseForecast(weather,'2030-01-01',37.5,127),rainChance:0};
  for(const [code,value] of [[0,'sunny'],[3,'unknown'],[45,'unknown'],[71,'snow'],[95,'storm']] as const)expect(forecastWeather({...f,code})).toBe(value);
  expect(forecastWeather({...f,code:0,high:35})).toBe('heat');expect(forecastWeather({...f,code:0,low:-15})).toBe('cold');expect(forecastWeather({...f,code:0,wind:70})).toBe('storm');
});
it('replays an existing HYUNDAI Seoul OSRM response and creates dated road-time facts',()=>{
  const raw=JSON.parse(readFileSync('tests/fixtures/hyundai-seoul-road.json','utf8'));
  const r=parseRoadRoute(raw,from,to);expect(r.points.length).toBe(116);expect(r.distance).toBeGreaterThan(1000);
  expect(r.fromAccess).toBeLessThan(1);expect(r.toAccess).toBeLessThan(1);
  const fact=roadFact(r,from,to,'taxi');expect(routeSchema.safeParse(fact).success).toBe(true);expect(fact.duration.value).toBe(Math.ceil(r.seconds/60));expect(fact.cost.value).toBeNull();expect(fact.walkMin.value).toBeNull();
  expect(roadURL(from,to)).toContain('126.972512,37.554704;126.977893,37.567005');
  expect(()=>parseRoadRoute(raw,{...from,latitude:0},to)).toThrow('1km');
  expect(()=>parseRoadRoute({code:'NoRoute',routes:[]},from,to)).toThrow('경로');
  expect(()=>roadURL({...from,longitude:181},to)).toThrow();
});
