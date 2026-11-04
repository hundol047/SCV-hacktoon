import type {Trip,Item} from './schema';
import type {Place} from '../data/demo';
export type VisitStop={item:Item;place:Place;restMinutes:number};
export function itineraryStops(trip:Trip,day:number):VisitStop[]{const result:VisitStop[]=[];for(const item of [...trip.items].filter(i=>i.day===day&&i.kind!=='move'&&i.placeId).sort((a,b)=>a.start-b.start)){const place=trip.catalog?.places.find(p=>p.id===item.placeId);if(!place)continue;const previous=result.at(-1);if(item.kind==='rest'&&previous?.place.id===place.id&&previous.item.end===item.start){previous.restMinutes+=item.end-item.start;previous.item={...previous.item,end:item.end};}else result.push({item:{...item},place,restMinutes:0});}return result;}
