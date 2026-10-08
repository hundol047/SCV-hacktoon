import tzLookup from 'tz-lookup';
import countries from 'world-countries';
import {z} from 'zod';
export function cityMetadata(region:string,lat:number,lon:number,countryCode?:string){const country=countries.find(c=>c.cca2.toLowerCase()===countryCode?.toLowerCase());return {region,latitude:lat,longitude:lon,timezone:tzLookup(lat,lon),countryCode:country?.cca2??null,currency:country?Object.keys(country.currencies)[0]??null:null};}
export async function exchangeRates(fetcher:typeof fetch=fetch){const response=await fetcher('https://api.frankfurter.dev/v1/latest',{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('환율 공급자 오류');const d=z.object({base:z.string().regex(/^[A-Z]{3}$/),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),rates:z.record(z.string(),z.number().positive())}).parse(await response.json());return {base:d.base,at:d.date+'T00:00:00.000Z',rates:d.rates,source:'https://api.frankfurter.dev/v1/latest'};}
