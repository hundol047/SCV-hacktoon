import type {Trip} from './schema';
import {estimateTrip,estimateDefaults,type EstimateRates} from './trip-estimate';
// Planning scenarios, not a statistical confidence interval or a booking quote.
export function costRange(trip:Trip,rates:EstimateRates={...estimateDefaults(trip),...trip.basics.pricing?.rates},saving=0){
 const estimate=estimateTrip(trip,rates);
 const entered=Math.min(estimate.total,(trip.basics.lodgings??[]).filter(s=>s.night>=1&&s.night<trip.basics.days).reduce((sum,s)=>sum+(s.totalPrice??0),0));
 const variable=Math.max(0,estimate.total-entered);
 const low=Math.floor(Math.max(0,entered+variable*.8-saving)/1000)*1000;
 const high=Math.ceil((entered+variable*1.2)/1000)*1000;
 return {...estimate,entered,variable,low,high};
}
export const formatCostRange=(r:{low:number;high:number})=>`${r.low.toLocaleString('ko-KR')}–${r.high.toLocaleString('ko-KR')}원`;
