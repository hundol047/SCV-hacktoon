import {measure} from './metrics';
import {cityMetadata,exchangeRates} from './world-data';
import {catalogSchema,type Catalog} from '../data/catalog';
import {OpenMapProvider} from '../adapters/real-data';
import {hash} from './security';
import {type RPC,StoreError} from './store';
export async function loadCatalog(rpc:RPC,region:string,appURL:string,refresh=false,limit=30,radius=10000):Promise<Catalog>{
 const key='catalog:'+hash(region+(limit===30&&radius===10000?'':':'+limit+':'+radius)),cached=refresh?null:await rpc.call('bopok_cache',{p_key:key});if(cached)return catalogSchema.parse(cached);
 if(!(await rpc.call('bopok_geo_guard',{p_provider:'nominatim'})).allowed||!(await rpc.call('bopok_geo_guard',{p_provider:'overpass'})).allowed)throw new StoreError('busy');
 const provider=new OpenMapProvider(appURL),location=await measure('catalog',()=>provider.location(region),rpc),catalog=await measure('catalog',()=>provider.places(region,location,limit,radius),rpc);catalog.cities=[{...cityMetadata(region,location.lat,location.lon,location.address?.country_code),limit,radius,cacheKey:key}];catalog.places=catalog.places.map(p=>({...p,region,currency:catalog.cities![0].currency??undefined}));try{catalog.fx=await measure('catalog',()=>exchangeRates(),rpc);}catch{/* Prices in another currency remain unknown. */}await rpc.call('bopok_cache',{p_key:key,p_value:catalog});return catalog;
}
