import {it,expect} from 'vitest';
import {probe} from '../scripts/probe-deployment.mjs';
it('deployment smoke test fails on a reachable but unready schema without sending paid requests',async()=>{
 let calls=0;const fetcher=async(url:unknown)=>{calls++;return String(url).includes('/api/health')?Response.json({ready:false,missing:['migration_missing']},{status:503}):new Response('보폭');};await expect(probe('https://example.org',fetcher as typeof fetch)).rejects.toThrow('migration_missing');expect(calls).toBe(2);
});
it('healthy release probe validates readiness and rules while demo mode remains explicit',async()=>{
 const fetcher=async(url:unknown)=>String(url).includes('/api/health')?Response.json({ready:true,missing:[]}):String(url).includes('/api/conditions')?Response.json({status:'rules',output:{maxWalkMin:20}}):new Response('보폭');expect((await probe('https://example.org',fetcher as typeof fetch)).ready).toBe(true);await expect(probe('http://example.org',fetcher as typeof fetch)).rejects.toThrow('HTTPS');
});
