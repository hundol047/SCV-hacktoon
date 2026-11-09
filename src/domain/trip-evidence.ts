import {z} from 'zod';
export const evidenceReadingSchema=z.object({
 label:z.string().max(160),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),amount:z.number().int().min(0).max(10000000).nullable(),note:z.string().max(500),
});
export type EvidenceReading=z.infer<typeof evidenceReadingSchema>;
export type TripEvidence={id:string;tripId:string;city:string;kind:'receipt'|'visit';name:string;createdAt:string;original:Blob;preview:Blob;reading:EvidenceReading;confirmed:boolean};
export const emptyReading:EvidenceReading={label:'',date:null,amount:null,note:''};
export function evidenceReady(e:Pick<TripEvidence,'reading'|'kind'>){const d=e.reading.date;const parsed=evidenceReadingSchema.safeParse(e.reading);return parsed.success&&!!e.reading.label.trim()&&!!d&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d&&(e.kind!=='receipt'||e.reading.amount!==null);}
export function evidenceSummary(rows:TripEvidence[]){const confirmed=rows.filter(e=>e.confirmed&&evidenceReady(e));const receipts=confirmed.filter(e=>e.kind==='receipt');return {confirmed,receipts,total:receipts.reduce((n,e)=>n+e.reading.amount!,0),visits:confirmed.filter(e=>e.kind==='visit')};}
