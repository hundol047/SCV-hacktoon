import type {Catalog} from '../data/catalog';
import {photoCatalog} from '../domain/photo-catalog';
import {placePhotoURL} from '../domain/place-photo';
import {officialPlacePhotos} from './place-photos';
export async function catalogWithPhotos(catalog:Catalog,lookup=officialPlacePhotos):Promise<Catalog>{
 const missing=catalog.places.filter(p=>p.id.startsWith('tourapi:')&&![p.visitorInfo?.imageUrl,...p.visitorInfo?.imageUrls??[]].some(placePhotoURL)).map(p=>p.id).slice(0,20);
 const photos=missing.length?await lookup(missing):{};
 return photoCatalog({...catalog,places:catalog.places.map(p=>photos[p.id]?{...p,visitorInfo:{...p.visitorInfo,...photos[p.id]}}:p)});
}
