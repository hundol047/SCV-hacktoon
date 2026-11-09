import {officialPlacePhotos} from '../../../server/place-photos';
import {z} from 'zod';
import {sameOrigin,json,readJSON} from '../../../server/security';
import {readKoreaSnapshot} from '../../../server/korea-tourism';
import {fetchTourAPIDetails} from '../../../server/tourapi-details';
import {fetchPlaceDetails} from '../../../server/place-details';
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'잘못된 요청 출처입니다.'},403);
 try{const {ids}=z.object({ids:z.array(z.string().regex(/^(osm:(node|way|relation):[1-9]\d{0,14}|tourapi:[1-9]\d{0,14})$/)).max(20)}).parse(await readJSON(request,5000));const snapshot=await readKoreaSnapshot();const wanted=new Set(ids);const selected=snapshot.records.filter(p=>wanted.has(p.id));const [osm,official,photos]=await Promise.all([fetchPlaceDetails(selected.map(p=>p.id)),fetchTourAPIDetails(selected),officialPlacePhotos(ids)]);const places=Object.fromEntries(selected.map(p=>[p.id,{...osm[p.id],...official[p.id]}]));return json({places:{...places,...Object.fromEntries(Object.entries(photos).map(([id,photo])=>[id,{...places[id],...photo}]))}});}catch{return json({places:{}});}
}
