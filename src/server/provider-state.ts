import {createHash} from 'node:crypto';
export const providerNames=['auth','routing','transit','ai','bot','catalog','fx'] as const;
export type ProviderName=typeof providerNames[number];
export type ProviderCheck={name:string;fingerprint:string;ok:boolean;code:string;checkedAt:string};
const variables:Record<ProviderName,string[]>={auth:['BOPok_SUPABASE_URL','BOPok_SUPABASE_ANON_KEY'],routing:['BOPok_ROUTE_KEY'],transit:['BOPok_GOOGLE_MAPS_KEY'],ai:['BOPok_AI_KEY','BOPok_AI_MODEL'],bot:['BOPok_TURNSTILE_SECRET','BOPok_TURNSTILE_SITE_KEY'],catalog:[],fx:[]};
export function providerFingerprint(name:ProviderName){return createHash('sha256').update(name+'|'+variables[name].map(k=>process.env[k]??'').join('|')).digest('hex');}
export function providerVerified(name:ProviderName,checks:ProviderCheck[],now=Date.now()){return checks.some(c=>c.name===name&&c.ok&&c.fingerprint===providerFingerprint(name)&&Number.isFinite(Date.parse(c.checkedAt))&&Date.parse(c.checkedAt)<=now&&now-Date.parse(c.checkedAt)<86400000);}
