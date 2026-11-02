import {eventSchema,type LocalEvent} from '../domain/local-events';
export function tourEvents(data:unknown,at=new Date().toISOString()){
  const d=data as {response?:{header?:{resultCode?:string};body?:{totalCount?:number;items?:{item?:Record<string,unknown>[]|Record<string,unknown>}}}};
  if(!['0000','00'].includes(String(d.response?.header?.resultCode)))throw Error('공식 행사 공급자가 요청을 처리하지 못했습니다.');
  const body=d.response?.body,items=body?.items?.item,rows=Array.isArray(items)?items:items&&typeof items==='object'?[items]:[];
  if(!Number.isSafeInteger(Number(body?.totalCount))||Number(body?.totalCount)<0)throw Error('행사 응답 형식이 올바르지 않습니다.');
  const date=(v:unknown)=>String(v??'').replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
  const coordinate=(v:unknown)=>v===undefined||v===null||v===''?null:Number(v);
  const events:LocalEvent[]=[];let omitted=0;
  for(const row of rows){const title=String(row.title??''),address=String(row.addr1??'');const parsed=eventSchema.safeParse({id:'tourapi:'+String(row.contentid??''),title,region:address.split(' ').slice(0,2).join(' '),kind:'festival',start:date(row.eventstartdate),end:date(row.eventenddate),address,description:'한국관광공사 행사 목록 조회 자료. 세부 운영시간·입장료·취소 여부는 원문 확인이 필요합니다.',source:'https://korean.visitkorea.or.kr/search/search_list.do?keyword='+encodeURIComponent(title),latitude:coordinate(row.mapy),longitude:coordinate(row.mapx),origin:'tourapi',collectedAt:at});if(parsed.success&&/^\d+$/.test(String(row.contentid)))events.push(parsed.data);else omitted++;}
  return {events,total:Number(body?.totalCount),omitted};
}
