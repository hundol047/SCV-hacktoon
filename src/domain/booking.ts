import type {Basics} from './schema';
export function airOrSeaTrip(b:Basics){const p=b.departureCoordinates;const departureJeju=!!p&&p.latitude>=33&&p.latitude<34&&p.longitude>=126&&p.longitude<127;const destinationJeju=/제주/.test(b.region+' '+b.title);return destinationJeju!==departureJeju||b.timezone!=='Asia/Seoul'||!!b.currency&&b.currency!=='KRW';}
