import type {Basics,TaxiPlan} from './schema';
export function savedPlans(b:Basics){const plans=new Map((b.coursePlans??[]).map(p=>[p.day??1,p]));if(b.taxiPlan)plans.set(b.taxiPlan.day??1,b.taxiPlan);return [...plans.values()].sort((a,d)=>(a.day??1)-(d.day??1));}
export function savePlan(b:Basics,plan:TaxiPlan):Basics{return {...b,taxiPlan:plan,coursePlans:[...savedPlans(b).filter(p=>(p.day??1)!==(plan.day??1)),plan].sort((a,d)=>(a.day??1)-(d.day??1))};}
export function removePlan(b:Basics,day:number):Basics{return {...b,taxiPlan:(b.taxiPlan?.day??1)===day?undefined:b.taxiPlan,coursePlans:savedPlans(b).filter(p=>(p.day??1)!==day)};}
