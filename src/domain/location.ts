import {z} from 'zod';
export const locationResultSchema=z.object({id:z.string().max(100),name:z.string().max(300),address:z.string().max(1500),latitude:z.number().min(30).max(40),longitude:z.number().min(123).max(133)});
export const locationsSchema=z.array(locationResultSchema).max(5);
export type LocationResult=z.infer<typeof locationResultSchema>;
