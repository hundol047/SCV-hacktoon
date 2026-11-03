import {expect,it} from 'vitest';
import {eventSchema,eventFileSchema,eventTrip,filterEvents,mergeEvents,eventBookmarks,type LocalEvent} from '../src/domain/local-events';
import {tourEvents} from '../src/adapters/events';
import {basicPromotion,promotionInputSchema,promotionReplySchema,promotionText} from '../src/domain/promotion';
import {tripSchema} from '../src/domain/schema';
const event:LocalEvent={id:'test',title:'검증용 문화행사',region:'서울',kind:'culture',start:'2030-01-01',end:'2030-01-03',address:'서울 테스트 주소',description:'테스트용 자료',source:'https://example.org/event',latitude:37.5,longitude:127,origin:'manual',collectedAt:'2026-11-02T00:00:00.000Z'};
it('행사 날짜·출처·좌표를 검사하고 중복 ID를 갱신한다',()=>{
  expect(eventSchema.safeParse(event).success).toBe(true);
  for(const patch of [{start:'2030-02-30'},{end:'2029-12-31'},{source:'javascript:alert(1)'},{latitude:100}])expect(eventSchema.safeParse({...event,...patch}).success).toBe(false);
  expect(mergeEvents([event],[{...event,title:'변경된 이름'}])).toHaveLength(1);
  expect(mergeEvents([event],[{...event,title:'변경된 이름'}])[0].title).toBe('변경된 이름');
  expect(eventFileSchema.safeParse({version:1,events:[event]}).success).toBe(true);
});
it('기간 중첩·지역·유형·검색어를 함께 적용한다',()=>{
  expect(filterEvents([event],'문화','서울','culture','2030-01-02','2030-01-10')).toHaveLength(1);
  expect(filterEvents([event],'','부산','','','')).toHaveLength(0);
  expect(filterEvents([event],'','','festival','','')).toHaveLength(0);
  expect(filterEvents([event],'','','','2030-01-04','')).toHaveLength(0);
});
it('보관 한도 초과 때 기존 행사를 조용히 삭제하지 않는다',()=>{
  const existing=Array.from({length:1000},(_,i)=>({...event,id:String(i)}));
  expect(()=>mergeEvents(existing,[{...event,id:'new'}])).toThrow('기존 자료는 유지');
  expect(existing).toHaveLength(1000);
  expect(mergeEvents(existing,[{...event,id:'0',title:'갱신'}])).toHaveLength(1000);
});
it('행사 기간 내 좌표 있는 자료만 여행으로 연결하며 비용·시간을 확정하지 않는다',()=>{
  const trip=eventTrip(event,'2030-01-02');expect(tripSchema.safeParse(trip).success).toBe(true);
  expect(tripSchema.safeParse(eventTrip({...event,title:'긴 행사 이름 '.repeat(16)},'2030-01-02')).success).toBe(true);
  expect(trip.basics.date).toBe('2030-01-02');expect(trip.catalog?.places[0].cost.value).toBeNull();expect(trip.catalog?.places[0].hours.value).toBeNull();
  expect(()=>eventTrip(event,'2030-01-04')).toThrow();expect(()=>eventTrip({...event,latitude:null},'2030-01-02')).toThrow();
});
it('공식 공급자의 날짜와 좌표를 정규화하고 잘못된 항목을 보고한다',()=>{
  const result=tourEvents({response:{header:{resultCode:'0000'},body:{totalCount:2,items:{item:[{contentid:'1',title:'공급자 테스트',addr1:'서울 종로구',eventstartdate:'20300101',eventenddate:'20300103',mapx:'127',mapy:'37.5'},{contentid:'2',title:'잘못된 날짜'}]}}}});
  expect(result.events[0]).toMatchObject({start:'2030-01-01',origin:'tourapi',longitude:127});expect(result.omitted).toBe(1);
  expect(()=>tourEvents({response:{header:{resultCode:'99'}}})).toThrow();
});
it('기본 홍보는 입력된 사실만 사용하고 채널별 형식을 구분한다',()=>{
  const input={business:'테스트 가게',region:'강릉',category:'카페',facts:'커피를 판매합니다.',offer:'',channel:'instagram' as const,tone:'calm' as const};
  const result=basicPromotion(input);expect(promotionReplySchema.safeParse(result).success).toBe(true);expect(promotionText(result)).toContain(input.facts);expect(promotionText(result)).not.toContain('할인');
  expect(basicPromotion({...input,channel:'sms'}).hashtags).toEqual([]);
  expect(basicPromotion({...input,channel:'blog'}).body).toContain('상품·서비스 소개');
  expect(promotionInputSchema.safeParse({...input,business:''}).success).toBe(false);
  expect(promotionReplySchema.safeParse({headline:'제목',body:'',hashtags:[]}).success).toBe(false);
});

it('event backups preserve bookmarks while accepting legacy files and removing orphan IDs',()=>{
  const file=eventFileSchema.parse(JSON.parse(JSON.stringify({version:1,events:[event],bookmarks:[event.id,'missing',event.id]})));
  expect(eventBookmarks(file.events,file.bookmarks,['other'])).toEqual([event.id]);
  expect(eventFileSchema.parse({version:1,events:[event]}).bookmarks).toEqual([]);
  expect(eventFileSchema.safeParse({version:1,events:[event],bookmarks:[42]}).success).toBe(false);
});
