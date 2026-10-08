import {catalogSchema,type Catalog} from '../data/catalog';
import {OpenMapProvider} from '../adapters/real-data';
import {hash} from './security';
import {type RPC,StoreError} from './store';
export async function loadCatalog(rpc:RPC,region:string,appURL:string,refresh=false):Promise<Catalog>{
 const key='catalog:'+hash(region),cached=refresh?null:await rpc.call('bopok_cache',{p_key:key});if(cached)return catalogSchema.parse(cached);
 if(!(await rpc.call('bopok_geo_guard',{p_provider:'nominatim'})).allowed||!(await rpc.call('bopok_geo_guard',{p_provider:'overpass'})).allowed)throw new StoreError('busy');
 const provider=new OpenMapProvider(appURL),location=await provider.location(region),catalog=await provider.places(region,location);await rpc.call('bopok_cache',{p_key:key,p_value:catalog});return catalog;
}
