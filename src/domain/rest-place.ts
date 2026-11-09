import type {Place} from '../data/demo';
import {recentFact,confirmedFacilities,type Facility} from './venue-details';
export function usableRestPlace(place:Place,required:Facility[]=[]){
 return place.seat.value===true&&recentFact(place.seat)&&confirmedFacilities(place,['toilet','stepFree',...required]);
}
