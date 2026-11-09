import {it,expect,vi} from 'vitest';
import {createOfficialPlacePhotos} from '../src/server/place-photos';
const reply=(item:unknown)=>Response.json({response:{header:{resultCode:'0000'},body:{items:{item}}}});
it('loads gallery photos when the primary is missing and coalesces simultaneous requests',async()=>{
 const lookup=createOfficialPlacePhotos();
 const fetcher=vi.fn(async(input:unknown)=>{const u=new URL(String(input));if(u.pathname.endsWith('detailCommon2')){expect(u.searchParams.get('firstImageYN')).toBe('Y');return reply([]);}return reply([{contentid:'123',originimgurl:'http://tong.visitkorea.or.kr/photo.jpg'},{contentid:'999',originimgurl:'https://tong.visitkorea.or.kr/wrong.jpg'},{originimgurl:'https://evil.example/image.jpg'}]);});
 const [a,b]=await Promise.all([lookup(['tourapi:123'],fetcher,'key'),lookup(['tourapi:123'],fetcher,'key')]);
 expect(a).toEqual(b);expect(a['tourapi:123'].imageUrls).toEqual(['https://tong.visitkorea.or.kr/photo.jpg']);expect(fetcher).toHaveBeenCalledTimes(2);
});
it('still uses the gallery when the common endpoint fails and covers every requested ID',async()=>{
 const ids=Array.from({length:20},(_,i)=>'tourapi:'+(i+1));
 const fetcher=vi.fn(async(input:unknown)=>{const u=new URL(String(input));if(u.pathname.endsWith('detailCommon2'))return new Response('',{status:503});return reply({contentid:u.searchParams.get('contentId'),originimgurl:'https://tong.visitkorea.or.kr/'+u.searchParams.get('contentId')+'.jpg'});});
 const result=await createOfficialPlacePhotos()(ids,fetcher,'key');expect(Object.keys(result)).toHaveLength(20);expect(fetcher).toHaveBeenCalledTimes(40);
});
it('retries transient failures instead of caching them as absent photos',async()=>{const lookup=createOfficialPlacePhotos();const fetcher=vi.fn(async()=>new Response('',{status:503}));await lookup(['tourapi:12'],fetcher,'key');await lookup(['tourapi:12'],fetcher,'key');expect(fetcher).toHaveBeenCalledTimes(4);});
