import {createHash,createPrivateKey,createPublicKey,sign,verify} from 'node:crypto';
import {placeSchema} from '../data/catalog';
import {Place} from '../data/demo';
import {reviewBody} from '../domain/verification';
function keys(){const secret=process.env.BOPok_SESSION_SECRET;if(!secret||secret.length<32)throw Error('Signing configuration');const seed=createHash('sha256').update('evidence:'+secret).digest(),privateKey=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),seed]),format:'der',type:'pkcs8'});return {privateKey,publicKey:createPublicKey(privateKey)};}
export function verificationKey(){return keys().publicKey.export({format:'der',type:'spki'}).toString('base64url');}
export function approvePlace(raw:unknown,id:string,checkedAt=new Date().toISOString()):Place{checkedAt=new Date(checkedAt).toISOString();const place=placeSchema.parse(raw);delete place.review;const signature=sign(null,Buffer.from(id+'|'+checkedAt+'|'+reviewBody(place)),keys().privateKey).toString('base64url');return {...place,review:{reviewId:id,checkedAt,signature}};}
export function validProof(place:Place){try{return !!place.review&&verify(null,Buffer.from(place.review.reviewId+'|'+place.review.checkedAt+'|'+reviewBody(place)),keys().publicKey,Buffer.from(place.review.signature,'base64url'));}catch{return false;}}
export function assertProofs(places:Place[]){if(places.some(p=>p.review&&!validProof(p)))throw Error('Invalid review signature');}
