import type {Place} from '../data/demo';
import {freshAt} from './world';
export type ReviewProof={reviewId:string;signature:string;checkedAt:string};
const trusted=new Set<string>();
export function reviewBody(place:Place){const {review,...body}=place;void review;return JSON.stringify(body);}
const trustKey=(place:Place)=>JSON.stringify(place.review)+reviewBody(place);
export function isReviewed(place:Place){return !!place.review&&trusted.has(trustKey(place))&&freshAt(place.review.checkedAt,7*86400000);}
export async function verifyReviewed(place:Place,publicKey:string){try{if(!place.review)return false;const bytes=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));const key=await crypto.subtle.importKey('spki',bytes(publicKey),{name:'Ed25519'},false,['verify']);const valid=await crypto.subtle.verify('Ed25519',key,bytes(place.review.signature),new TextEncoder().encode(place.review.reviewId+'|'+place.review.checkedAt+'|'+reviewBody(place)));if(valid)trusted.add(trustKey(place));return valid;}catch{return false;}}
