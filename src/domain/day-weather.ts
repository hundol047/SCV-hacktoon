import type {Basics} from './schema';
import {dayDate} from './schema';
import {forecastFresh,forecastWeather} from './live-weather';
export function dayWeather(b:Basics,day:number,now=Date.now()){
 const p=b.coursePreferences?.find(p=>p.day===day);
 if(p?.forecast){if(!forecastFresh(p.forecast,dayDate(b,day),now))throw Error('예보를 다시 조회하거나 날씨를 직접 선택해 주세요. 저장된 예보의 날짜 또는 유효 시간이 지났습니다.');return forecastWeather(p.forecast);}
 return p?.weather??'unknown';
}
