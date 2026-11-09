import type {Catalog} from '../data/catalog';
import {placePhotoURL} from './place-photo';
/** Retain actual venue images only; never substitute an unrelated destination. */
export function photoCatalog(catalog:Catalog):Catalog {
 const places=catalog.places.flatMap(place=>{
  const images=[...new Set([place.visitorInfo?.imageUrl,...place.visitorInfo?.imageUrls??[]].map(placePhotoURL).filter((url):url is string=>!!url))];
  return images.length?[{...place,visitorInfo:{...place.visitorInfo,imageUrl:images[0],imageUrls:images.slice(0,8)}}]:[];
 });
 const ids=new Set(places.map(place=>place.id));
 return {...catalog,places,routes:catalog.routes.filter(route=>ids.has(route.fromId)&&ids.has(route.toId))};
}
