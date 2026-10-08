import { z } from "zod";
import {
  Trip,
  tripSchema,
  conditionsSchema,
  basicsSchema,
  itemSchema,
} from "../domain/schema";
export const STORAGE_KEY = "bopok:trip:v1";
export const FORM_KEY = "bopok:form:v1";
export const draftSchema = z.object({
  version: z.literal(1),
  conditions: conditionsSchema,
  basics: basicsSchema,
  step: z.number().int().min(0).max(2),
  existing: z.boolean(),
  importText: z.string().max(10000),
  importItems: z.array(itemSchema).max(100),
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
    storage.setItem(STORAGE_KEY, JSON.stringify(tripSchema.parse(trip)));
    return null;
  } catch {
    return "여행을 저장하지 못했습니다. 현재 화면은 사용할 수 있지만 새로고침하면 내용이 사라질 수 있습니다.";
  }
}
