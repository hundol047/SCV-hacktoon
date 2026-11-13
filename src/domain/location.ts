import {z} from 'zod';
export const locationResultSchema=z.object({id:z.string().max(100),name:z.string().max(300),address:z.string().max(1500),latitude:z.number().min(30).max(40),longitude:z.number().min(123).max(133)});
export const locationsSchema=z.array(locationResultSchema).max(5);
export type LocationResult=z.infer<typeof locationResultSchema>;
export function uniqueLocations(locations:LocationResult[]){
 const normalize=(s:string)=>s.replace(/[\s,·]/g,'').toLowerCase();
 return locations.filter((place,index)=>!locations.slice(0,index).some(other=>other.id===place.id||normalize(other.address)===normalize(place.address)&&Math.abs(other.latitude-place.latitude)<0.0005&&Math.abs(other.longitude-place.longitude)<0.0005));
}
