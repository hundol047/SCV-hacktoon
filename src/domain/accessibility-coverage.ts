import type {Catalog} from '../data/catalog';
import {confirmedFacilities,recentFact,type Facility} from './venue-details';
import {tourismVisitAllowed} from './tourism-diversity';
export function accessibilityCoverage(catalog:Catalog,required:Facility[]){
 const visits=catalog.places.filter(p=>p.kind==='visit'&&tourismVisitAllowed(p));
 return {total:visits.length,matching:visits.filter(p=>confirmedFacilities(p,required)).length,rows:required.map(key=>({key,confirmed:visits.filter(p=>confirmedFacilities(p,[key])).length,unavailable:visits.filter(p=>p.facilities?.[key]?.value===false&&recentFact(p.facilities[key])).length,unknown:visits.filter(p=>p.facilities?.[key]?.value==null||!recentFact(p.facilities?.[key])).length}))};
}
