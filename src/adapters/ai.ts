import { z } from "zod";
import { evidenceIds, placeById } from "../data/demo";
export const extractionSchema = z.object({
  maxWalkMin: z.number().int().min(1).max(180).nullable(),
  maxWalkM: z.number().int().min(1).max(10000).nullable(),
  restInterval: z.number().int().min(1).max(240).nullable(),
  restMin: z.number().int().min(1).max(120).nullable(),
  avoidStairs: z.boolean().nullable(),
  foodAvoids: z.array(z.string().max(60)).max(12),
  experiences: z.array(z.string().max(60)).max(12),
  questions: z.array(z.string().max(200)).max(12),
  placeIds: z.array(z.string()).max(30),
  evidenceIds: z.array(z.string()).max(30),
});
export type Extraction = z.infer<typeof extractionSchema>;
export type AIResult = {
  status: "rules" | "connected" | "fallback";
  output: Extraction;
  message: string;
};
export interface AIProvider {
  extract(text: string): Promise<Extraction>;
}
export function validateExtraction(data: unknown): Extraction {
  const result = extractionSchema.parse(data);
  if (
    result.placeIds.some((id) => !placeById.has(id)) ||
    result.evidenceIds.some((id) => !evidenceIds.has(id))
  )
    throw new Error("후보 또는 근거 ID가 없습니다.");
  return result;
}
export class RulesProvider implements AIProvider {
  async extract(text: string): Promise<Extraction> {
    const walking = text.match(
      /(?:한\s*번(?:에|\s*걸을\s*때는?)?|걷기|보행)[^。.!?\n]{0,25}?(\d+)\s*분/,
    );
    const distance = text.match(
      /(?:걷기|보행|한\s*번에)[^。.!?\n]{0,20}?(\d+)\s*(?:미터|m)(?!in)/i,
    );
    const interval = text.match(/(\d+)\s*분마다\s*(?:휴식|쉬)/);
    const rest = text.match(/(?:휴식|쉬는\s*시간)[^。.!?\n]{0,10}?(\d+)\s*분/);
    return validateExtraction({
      maxWalkMin: walking ? Number(walking[1]) : null,
      maxWalkM: distance ? Number(distance[1]) : null,
      restInterval: interval ? Number(interval[1]) : null,
      restMin: rest ? Number(rest[1]) : null,
      avoidStairs: /계단.{0,10}(?:피|없|싫)/.test(text) ? true : null,
      foodAvoids: /매운\s*음식.{0,10}(?:피|싫|안)/.test(text)
        ? ["매운 음식"]
        : [],
      experiences: /바다.{0,15}(?:보고|보기|원|좋)/.test(text)
        ? ["바다 보기"]
        : [],
      questions: [
        ...(!walking
          ? ["한 번에 걷고 싶은 최대 시간을 알려 주실 수 있나요?"]
          : []),
        ...(!rest ? ["한 번 쉴 때 원하는 시간은 몇 분인가요?"] : []),
        "추출되지 않은 내용은 아래 조건 카드에서 직접 확인해 주세요.",
      ],
      placeIds: [],
      evidenceIds: [],
    });
  }
}
export async function extractWithFallback(
  text: string,
  provider: AIProvider | null,
): Promise<AIResult> {
  if (!provider)
    return {
      status: "rules",
      output: await new RulesProvider().extract(text),
      message: "규칙 기반 시연 · AI 요청을 보내지 않았습니다.",
    };
  try {
    return {
      status: "connected",
      output: await provider.extract(text),
      message: "AI 연결됨 · 추출한 조건은 직접 확인해 주세요.",
    };
  } catch {
    return {
      status: "fallback",
      output: await new RulesProvider().extract(text),
      message: "AI 연결 실패 · 규칙 기반 점검으로 전환했습니다.",
    };
  }
}
