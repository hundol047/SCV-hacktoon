import {catalogSchema,type Catalog} from '../data/catalog';
import type {Trip} from './schema';

export function refreshCatalog(trip:Trip,fresh:Catalog,region:string):Catalog{
 const previous=trip.catalog;
 if(!previous||previous.mode!=='real'||fresh.mode!=='real')throw Error('실제 장소 자료가 필요합니다.');
 const required=new Set([trip.items,...trip.history].flat().flatMap(i=>[i.placeId,i.fromId,i.toId].filter((id):id is string=>!!id)));
 const old=new Map(previous.places.map(p=>[p.id,p]));
 const fields=['walkMin','walkM','stairs','seat','foods','cost','hours','situations'] as const;
 const updated=fresh.places.map(p=>{const before=old.get(p.id),merged={...p};if(before)for(const field of fields)if(before[field].checked==='user')Object.assign(merged,{[field]:before[field]});return merged;});
 const candidates=[...updated,...previous.places.filter(p=>required.has(p.id)||p.region&&p.region!==region)];
 const updatedById=new Map(updated.map(p=>[p.id,p]));
 const unique=[...new Map(candidates.map(p=>[p.id,p])).keys()].map(id=>updatedById.get(id)??old.get(id)!);
 // Current and undo references take priority over unselected search candidates.
 const places=[...unique.filter(p=>required.has(p.id)),...unique.filter(p=>!required.has(p.id))].slice(0,2000),kept=new Map(places.map(p=>[p.id,p]));
 const unchanged=(id:string)=>{const before=old.get(id),after=kept.get(id);return !!before&&!!after&&before.latitude===after.latitude&&before.longitude===after.longitude;};
 return catalogSchema.parse({...fresh,region:previous.region,cities:[...(previous.cities?.filter(c=>c.region!==region)??[]),...(fresh.cities??[])],places,routes:previous.routes.filter(r=>unchanged(r.fromId)&&unchanged(r.toId)),fx:fresh.fx??previous.fx});
}
