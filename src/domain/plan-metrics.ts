import type {Trip} from './schema';
import {estimateDefaults,estimateTrip} from './trip-estimate';
import {benefitSavings} from './benefit-budget';
export function planMetrics(trip:Trip){const rates={...estimateDefaults(trip),...trip.basics.pricing?.rates};const cost=estimateTrip(trip,rates).total-benefitSavings(trip,rates.admission,trip.basics.pricing?.eligible??{},new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'})).saving;return {cost:Math.max(0,cost),travel:trip.items.filter(i=>i.kind==='move').reduce((s,i)=>s+i.end-i.start,0)+(trip.basics.commutes??[]).reduce((s,i)=>s+i.minutes,0),visits:trip.items.filter(i=>i.kind==='visit').length,rest:trip.items.filter(i=>i.kind==='rest'&&!i.placeId?.startsWith('stay:')).reduce((s,i)=>s+i.end-i.start,0)};}
