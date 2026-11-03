import {forecastFresh} from './live-weather';
import {dayDate} from './schema';
import type {Basics} from './schema';
import type {Catalog} from '../data/catalog';
import {isTravelOnlyDay} from './world';
import {weatherAllowed,weatherGuidance} from './weather';

export function vehicleDayError(basics:Basics,catalog:Catalog,day:number,ids:string[]):string|null{
  if(!Number.isInteger(day)||day<1||day>basics.days)return '여행 기간 안의 여행일을 선택해 주세요.';
  if(basics.travelDays?.includes(day)||isTravelOnlyDay(basics,day))return '이동 전용 날짜에는 관광 코스를 배정할 수 없습니다. 다른 여행일을 선택하세요.';
  const region=basics.destinations?.find(d=>d.startDay<=day&&d.endDay>=day)?.region??basics.region;
  const places=ids.map(id=>catalog.places.find(p=>p.id===id));
  if(places.some(p=>!p||(p.region??catalog.region)!==region))return '선택한 여행일의 지역에 있는 장소만 골라 주세요.';
  const preference=basics.coursePreferences?.find(p=>p.day===day);
  if(preference?.forecast&&!forecastFresh(preference.forecast,dayDate(basics,day)))return '예보를 다시 조회하거나 날씨를 직접 선택해 주세요.';
  const weather=preference?.weather??'unknown';
  if(weather==='storm')return weatherGuidance.storm;
  if(places.some(p=>!weatherAllowed(p!,weather)))return '선택한 날씨에 맞지 않는 야외 장소가 있습니다. 장소 또는 날씨 가정을 확인하세요.';
  return null;
}
