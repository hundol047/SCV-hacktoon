import {z} from 'zod';
import {tripSchema} from './schema';
export const cloudSchema=z.object({id:z.string().uuid(),storageVersion:z.number().int().nonnegative(),role:z.enum(['owner','editor','viewer']),trip:tripSchema,expiresAt:z.string().optional()});
export type CloudTrip=z.infer<typeof cloudSchema>;
