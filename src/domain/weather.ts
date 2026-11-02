import {z} from 'zod';
import type {Place} from '../data/demo';
export const weatherSchema=z.enum(['unknown','sunny','rain','snow','heat','cold','storm']);
export type Weather=z.infer<typeof weatherSchema>;
export const weatherLabels:Record<Weather,string>={unknown:'날씨 미확인',sunny:'맑음',rain:'비',snow:'눈',heat:'폭염',cold:'한파',storm:'태풍·호우·강풍 특보'};
export const weatherGuidance:Record<Weather,string>={unknown:'날씨 미확인: 날씨 적합성을 판단하지 않습니다.',sunny:'야외 태그가 있는 후보를 우선합니다. 자외선·휴식·실제 기온을 확인하세요.',rain:'실내 기록을 우선하고 야외 후보는 제외합니다. 이동 구간의 비 노출은 별도 확인하세요.',snow:'실내 기록을 우선하고 야외 후보는 제외합니다. 도로 결빙·운행 여부를 확인하세요.',heat:'실내 기록을 우선하고 야외 후보는 제외합니다. 냉방은 확인된 정보가 아닙니다.',cold:'실내 기록을 우선하고 야외 후보는 제외합니다. 난방·도로 상태는 별도 확인하세요.',storm:'여행 연기와 공식 특보 확인을 우선하세요. 자동 관광 추천을 중단합니다.'};
// Broad categories such as museum/restaurant do not prove indoor access.
export function settingFromTags(tags:Record<string,string>):'indoor'|'outdoor'|'unknown'{
  if(tags.indoor==='yes'&&tags.outdoor!=='yes')return 'indoor';
  if(tags.indoor==='yes'&&tags.outdoor==='yes')return 'unknown';
  if(tags.indoor==='no'||tags.outdoor==='yes'||tags.natural==='beach'||tags.leisure==='park'||tags.tourism==='viewpoint')return 'outdoor';
  return 'unknown';
}
export function weatherAllowed(p:Place,w:Weather){return w!=='storm'&&(!['rain','snow','heat','cold'].includes(w)||p.setting?.value!=='outdoor');}
export function weatherScore(p:Place,w:Weather){const value=p.setting?.value;if(w==='unknown')return 0;if(w==='sunny')return value==='outdoor'?2:0;return value==='indoor'?2:0;}
export function weatherReason(p:Place,w:Weather){const setting=p.setting?.value??'unknown';return `${setting==='indoor'?'실내 기록':setting==='outdoor'?'야외 기록':'실내외 미확인'} · ${weatherLabels[w]}${setting==='unknown'?' 적합성 확인 필요':''}`;}
