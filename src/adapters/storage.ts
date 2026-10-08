import { z } from "zod";
import {catalogSchema} from '../data/catalog';
import {
  Trip,
  tripSchema,
  conditionsSchema,
  basicsSchema,
  itemSchema,
} from "../domain/schema";
export const STORAGE_KEY = "bopok:trip:v1";
export const FORM_KEY = "bopok:form:v1";
export const LIBRARY_KEY='bopok:library:v1';
const librarySchema=z.object({version:z.literal(1),trips:z.array(tripSchema).max(20)});
export const TRIP_FILE_LIMIT=8388608;
export function loadLibrary(storage:Pick<Storage,'getItem'>):Trip[]{try{const raw=storage.getItem(LIBRARY_KEY);if(!raw)return [];const value=z.object({version:z.literal(1),trips:z.array(z.unknown()).max(20)}).parse(JSON.parse(raw)),seen=new Set<string>();return value.trips.flatMap(t=>{const parsed=tripSchema.safeParse(t);if(!parsed.success||seen.has(parsed.data.id))return [];seen.add(parsed.data.id);return [parsed.data];});}catch{return [];}}
export function importTrip(text:string){if(new TextEncoder().encode(text).length>TRIP_FILE_LIMIT)throw Error('8 MiB 이하의 보폭 JSON 파일을 선택해 주세요.');return tripSchema.parse(JSON.parse(text));}
export function exportTrip(trip:Trip){const text=JSON.stringify(tripSchema.parse(trip));if(new TextEncoder().encode(text).length>TRIP_FILE_LIMIT)throw Error('여행 파일이 8 MiB를 넘습니다. 불필요한 이전 일정이나 자료를 줄여 주세요.');return text;}
export const draftSchema = z.object({
  version: z.literal(1),
  conditions: conditionsSchema,
  basics: basicsSchema,
  step: z.number().int().min(0).max(2),
  existing: z.boolean(),
  importText: z.string().max(10000),
  importItems: z.array(itemSchema).max(1000),
  catalog:catalogSchema.optional(),
});
export type FormDraft = z.infer<typeof draftSchema>;
export function loadDraft(storage: Pick<Storage, "getItem">): FormDraft | null {
  try {
    const raw = storage.getItem(FORM_KEY);
    if (!raw) return null;
    return draftSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}
export function saveDraft(
  storage: Pick<Storage, "setItem">,
  draft: FormDraft,
): string | null {
  try {
    storage.setItem(FORM_KEY, JSON.stringify(draftSchema.parse(draft)));
    return null;
  } catch {
    return "입력 중인 초안을 저장하지 못했습니다. 내용을 확인해 주세요.";
  }
}
export function loadTrip(storage: Pick<Storage, "getItem">): {
  trip: Trip | null;
  error: string | null;
} {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { trip: null, error: null };
    const parsed = tripSchema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return {
        trip: null,
        error:
          "저장 데이터 형식이 맞지 않습니다. 삭제하거나 새 여행을 만들어 주세요.",
      };
    return { trip: parsed.data, error: null };
  } catch {
    return {
      trip: null,
      error:
        "저장 데이터를 읽지 못했습니다. 브라우저 저장소 설정을 확인해 주세요.",
    };
  }
}
export function saveTrip(
  storage: Pick<Storage, "setItem">,
  trip: Trip,
): string | null {
  try {
    const validated=tripSchema.parse(trip);
    storage.setItem(STORAGE_KEY, JSON.stringify(validated));
    const readable=storage as Pick<Storage,'setItem'|'getItem'>;
    if(typeof readable.getItem==='function'){const library=loadLibrary(readable).filter(t=>t.id!==trip.id);try{storage.setItem(LIBRARY_KEY,JSON.stringify(librarySchema.parse({version:1,trips:[validated,...library].slice(0,20)})));}catch{return '현재 여행은 저장했지만 보관함 갱신에 실패했습니다. 기존 보관함은 유지됩니다. JSON으로 내보내 주세요.';}}
    return null;
  } catch {
    return "여행을 저장하지 못했습니다. 현재 화면은 사용할 수 있지만 새로고침하면 내용이 사라질 수 있습니다.";
  }
}
