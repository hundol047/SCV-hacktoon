import type {Place} from '../data/demo';
import {haversineKm} from './taxi-plan';

// Google Maps URLs require no API key. Send only coordinates after a user click.
export function mapDirections(from:Place,to:Place,transport:string):string|null{
  if(haversineKm(from,to)===null)return null;
  const params=new URLSearchParams({api:'1',origin:`${from.latitude},${from.longitude}`,destination:`${to.latitude},${to.longitude}`,travelmode:transport==='walk'?'walking':transport==='transit'?'transit':'driving'});
  return `https://www.google.com/maps/dir/?${params}`;
}
