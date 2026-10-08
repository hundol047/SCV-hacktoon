import { z } from 'zod';
import { Trip,tripSchema } from '../domain/schema';
import {assertProofs} from './verification';
export class StoreError extends Error {constructor(public code:string){super(code);}}
export interface RPC {call(name:string,args:Record<string,unknown>):Promise<any>;}
export class SupabaseRPC implements RPC{
  constructor(private url:string,private key:string,private fetcher:typeof fetch=fetch){const u=new URL(url);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname)))throw new StoreError('configuration');}
  async call(name:string,args:Record<string,unknown>){
    const started=Date.now(),endpoint=`${this.url.replace(/\/$/,'')}/rest/v1/rpc/`,headers={apikey:this.key,Authorization:`Bearer ${this.key}`,'Content-Type':'application/json'};
    const events:Record<string,string>={bopok_trip:'storage',bopok_reserve:'quota',bopok_cache:'catalog',bopok_identity:'auth',bopok_claim:'auth'};let code='failed';
    try{
      const response=await this.fetcher(endpoint+name,{method:'POST',headers,body:JSON.stringify(args),signal:AbortSignal.timeout(10000),cache:'no-store'});
      if(!response.ok)throw new StoreError('unavailable');
      const data=await response.json();
      if(data?.error){code=['forbidden','not_found','conflict','limit','capacity','invalid'].includes(data.error)?'denied':'failed';throw new StoreError(data.error);}
      code=data?.allowed===false?'denied':'ok';return data;
    }finally{
      if(events[name])try{await this.fetcher(endpoint+'bopok_metric',{method:'POST',headers,body:JSON.stringify({p_event:events[name],p_code:code,p_value:Math.min(10000000,Date.now()-started)}),signal:AbortSignal.timeout(1000),cache:'no-store'});}catch{}
    }
  }
}
export function configuredRPC():RPC|null{const url=process.env.BOPok_SUPABASE_URL,key=process.env.BOPok_SUPABASE_KEY;try{return url&&key?new SupabaseRPC(url,key):null;}catch{return null;}}
export const cloudSchema=z.object({id:z.string().uuid(),storageVersion:z.number().int().nonnegative(),role:z.enum(['owner','editor','viewer']),trip:tripSchema,expiresAt:z.string().optional()});
export type CloudTrip=z.infer<typeof cloudSchema>;
export class TripStore{
  constructor(private rpc:RPC){}
  async action(action:string,owner:string,id?:string,token='',payload?:unknown,expected?:number,role?:string){const data=await this.rpc.call('bopok_trip',{p_action:action,p_owner:owner,p_id:id??null,p_token:token,p_payload:payload??null,p_expected:expected??null,p_role:role??'viewer'});if(data?.error)throw new StoreError(data.error);return data;}
  async create(owner:string,trip:Trip):Promise<CloudTrip>{assertProofs(trip.catalog?.places??[]);return cloudSchema.parse(await this.action('create',owner,undefined,'',tripSchema.parse(trip)));}
  async get(owner:string,id:string,token=''):Promise<CloudTrip>{return cloudSchema.parse(await this.action('get',owner,id,token));}
  async update(owner:string,id:string,token:string,trip:Trip,expected:number):Promise<CloudTrip>{assertProofs(trip.catalog?.places??[]);return cloudSchema.parse(await this.action('update',owner,id,token,tripSchema.parse(trip),expected));}
  async reserve(subject:string,options:{tokens?:number;cost?:number;minuteLimit?:number;dailyRequests?:number;dailyTokens?:number;dailyCost?:number;scope?:'general'|'ai'|'feedback'|'route'|'session'|'storage'|'recovery'|'auth'|'review'|'refresh'}={}){const result=await this.rpc.call('bopok_reserve',{p_subject:subject,p_tokens:options.tokens??0,p_cost:options.cost??0,p_minute_limit:options.minuteLimit??10,p_daily_requests:options.dailyRequests??500,p_daily_tokens:options.dailyTokens??1000000,p_daily_cost:options.dailyCost??5,p_scope:options.scope??'general'});return z.object({allowed:z.boolean(),reservedTokens:z.number().optional(),reservedCostUsd:z.number().optional(),remainingRequests:z.number().optional()}).parse(result);}
}
