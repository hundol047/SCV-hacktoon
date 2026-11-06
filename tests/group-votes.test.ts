import {beforeAll,afterAll,it,expect} from 'vitest';
import {database,rpc} from '../scripts/test-store.mjs';
let db:any;beforeAll(async()=>{db=await database();},20000);afterAll(()=>db.close());
const room='a'.repeat(64),owner='b'.repeat(64),guest='c'.repeat(64);
const call=(action:string,voter=owner,payload:unknown={})=>rpc(db,'bopok_group',{p_action:action,p_token:room,p_voter:voter,p_payload:payload});
it('shares votes across people and updates one vote per browser and place',async()=>{
 await call('create',owner,{places:[{id:'p1',name:'박물관'}]});await call('vote',guest,{placeId:'p1',name:'동행자',vote:1,comment:'가고 싶어요'});let read=await call('read');expect(read.votes).toHaveLength(1);expect(read.votes[0].mine).toBe(false);
 await call('vote',guest,{placeId:'p1',name:'동행자',vote:-1,comment:'다른 곳'});read=await call('read');expect(read.votes).toHaveLength(1);expect(read.votes[0].vote).toBe(-1);
 expect((await call('vote',guest,{placeId:'wrong',name:'동행자',vote:1})).error).toBe('invalid');
 expect((await rpc(db,'bopok_group',{p_action:'read',p_token:'d'.repeat(64),p_voter:guest})).error).toBe('not_found');
});
