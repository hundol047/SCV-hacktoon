import {z} from 'zod';
import type {Weather} from './weather';
export const forecastSchema=z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),fetchedAt:z.string().datetime(),latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),timezone:z.string().min(1),code:z.number().int(),high:z.number().min(-100).max(70),low:z.number().min(-100).max(70),rainChance:z.number().min(0).max(100),wind:z.number().min(0).max(500),current:z.number().min(-100).max(70).nullable(),currentTime:z.string().nullable()}).refine(f=>f.low<=f.high,'기온 범위가 올바르지 않습니다.');
export type Forecast=z.infer<typeof forecastSchema>;
export function forecastHazards(f:Forecast):string[]{
  const risks:string[]=[];
  if([95,96,99].includes(f.code))risks.push('뇌우');
  if(f.wind>=62)risks.push('강풍');
  if([71,73,75,77,85,86].includes(f.code))risks.push('눈');
  if([56,57,66,67].includes(f.code)||(f.low<=0&&([51,53,55,61,63,65,80,81,82].includes(f.code)||f.rainChance>=60)))risks.push('결빙·어는 비');
  if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(f.code)||f.rainChance>=60)risks.push('비');
  if(f.high>=33)risks.push('폭염');if(f.low<=-12)risks.push('한파');
  if([45,48].includes(f.code))risks.push('안개');
  return risks;
}
export function forecastWeather(f:Forecast):Weather{
  const r=forecastHazards(f);
  if(r.includes('뇌우')||r.includes('강풍'))return 'storm';
  if(r.includes('눈')||r.includes('결빙·어는 비'))return 'snow';
  if(r.includes('한파'))return 'cold';if(r.includes('폭염'))return 'heat';
  if(r.includes('비'))return 'rain';
  return f.code===0||f.code===1?'sunny':'unknown';
}
export function parseForecast(raw:unknown,date:string,latitude:number,longitude:number):Forecast{
  const n=z.number().finite();const data=z.object({timezone:z.string(),daily:z.object({time:z.array(z.string()),weather_code:z.array(n.nullable()),temperature_2m_max:z.array(n.nullable()),temperature_2m_min:z.array(n.nullable()),precipitation_probability_max:z.array(n.nullable()),wind_speed_10m_max:z.array(n.nullable())}),current:z.object({temperature_2m:n.nullable(),time:z.string()}).optional()}).parse(raw);
  const index=data.daily.time.indexOf(date);if(index<0)throw Error('선택한 날짜의 예보가 없습니다. 예보는 보통 오늘부터 16일 이내만 제공됩니다.');
  const d=data.daily;
  return forecastSchema.parse({date,latitude,longitude,timezone:data.timezone,fetchedAt:new Date().toISOString(),code:d.weather_code[index],high:d.temperature_2m_max[index],low:d.temperature_2m_min[index],rainChance:d.precipitation_probability_max[index],wind:d.wind_speed_10m_max[index],current:data.current?.temperature_2m??null,currentTime:data.current?.time??null});
}
export function forecastURL(latitude:number,longitude:number){
  z.number().min(-90).max(90).parse(latitude);z.number().min(-180).max(180).parse(longitude);
  return 'https://api.open-meteo.com/v1/forecast?'+new URLSearchParams({latitude:String(latitude),longitude:String(longitude),timezone:'auto',forecast_days:'16',daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max',current:'temperature_2m',temperature_unit:'celsius',wind_speed_unit:'kmh'});
}
export function forecastFresh(f:Forecast,date:string,now=Date.now()){const age=now-Date.parse(f.fetchedAt);return f.date===date&&age>=0&&age<2*3600000;}
