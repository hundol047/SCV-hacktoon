import {it,expect} from 'vitest';
import {photoCatalog} from '../src/domain/photo-catalog';
import {demoCatalog} from '../src/data/catalog';
it('requires a safe actual image for every visit, meal and rest candidate',()=>{
 const places=demoCatalog.places.slice(0,4).map((p,i)=>({...p,id:'p'+i,kind:(['visit','meal','rest','visit'] as const)[i],visitorInfo:i===0?{imageUrl:'http://tong.visitkorea.or.kr/visit.jpg'}:i===1?{imageUrls:['https://tong.visitkorea.or.kr/meal.jpg']}:i===2?{imageUrl:'https://untrusted.example/fake.jpg'}:undefined}));
 const result=photoCatalog({...demoCatalog,places,routes:[]});
 expect(result.places.map(p=>p.id)).toEqual(['p0','p1']);expect(result.places.every(p=>p.visitorInfo?.imageUrl?.startsWith('https://'))).toBe(true);expect(places).toHaveLength(4);
});
it('uses a safe secondary photo and removes orphaned routes',()=>{
 const places=demoCatalog.places.slice(0,2).map((p,i)=>({...p,visitorInfo:i===0?{imageUrl:'https://invalid.example/photo.jpg',imageUrls:['https://tong.visitkorea.or.kr/real.jpg']}:undefined}));
 const result=photoCatalog({...demoCatalog,places});expect(result.places).toHaveLength(1);expect(result.places[0].visitorInfo?.imageUrl).toBe('https://tong.visitkorea.or.kr/real.jpg');expect(result.routes.every(r=>r.fromId===places[0].id&&r.toId===places[0].id)).toBe(true);
});
import {catalogWithPhotos} from '../src/server/photo-catalog';
it('recovers gallery-only venues before excluding missing photos',async()=>{
 const catalog={...demoCatalog,routes:[],places:demoCatalog.places.slice(0,2).map((p,i)=>({...p,id:'tourapi:'+(i+1),visitorInfo:undefined}))};
 const result=await catalogWithPhotos(catalog,async ids=>{expect(ids).toEqual(['tourapi:1','tourapi:2']);return {'tourapi:1':{imageUrl:'https://tong.visitkorea.or.kr/gallery.jpg',imageUrls:['https://tong.visitkorea.or.kr/gallery.jpg']}};});
 expect(result.places.map(p=>p.id)).toEqual(['tourapi:1']);
});
