import {z} from 'zod';
import {sameOrigin,json,readJSON} from '../../../server/security';
import {readKoreaSnapshot} from '../../../server/korea-tourism';
import {fetchPlaceDetails} from '../../../server/place-details';
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'잘못된 요청 출처입니다.'},403);
 try{const {ids}=z.object({ids:z.array(z.string().regex(/^osm:(node|way|relation):[1-9]\d{0,14}$/)).max(20)}).parse(await readJSON(request,5000));const snapshot=await readKoreaSnapshot();const known=new Set(snapshot.records.map(p=>p.id));return json({places:await fetchPlaceDetails([...new Set(ids)].filter(id=>known.has(id)))});}catch{return json({places:{}});}
}
