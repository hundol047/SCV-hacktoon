import { z } from "zod";
import { OpenAIProvider, extractWithFallback } from "../../../adapters/ai";
export const runtime = "nodejs";
const requestSchema = z.object({
  text: z.string().trim().min(1).max(1800),
  consent: z.boolean(),
});
const requests = new Map<string, { count: number; until: number }>();
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 16000)
    return Response.json({ error: "입력이 너무 깁니다." }, { status: 413 });
  // Bounded process-local demo rate limit; production needs shared storage and trusted client identity.
  const key = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const now = Date.now();
  for (const [k, v] of requests) if (v.until < now) requests.delete(k);
  if (requests.size >= 500 && !requests.has(key))
    return Response.json(
      { error: "잠시 후 다시 시도해 주세요." },
      { status: 429 },
    );
  const bucket = requests.get(key) ?? { count: 0, until: now + 60000 };
  bucket.count++;
  requests.set(key, bucket);
  if (bucket.count > 10)
    return Response.json(
      { error: "1분에 10회까지 확인할 수 있습니다." },
      { status: 429 },
    );
  try {
    const raw = await request.text();
    if (raw.length > 16000)
      return Response.json({ error: "입력이 너무 깁니다." }, { status: 413 });
    const parsed = requestSchema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return Response.json(
        { error: "여행 조건을 1~1800자로 입력해 주세요." },
        { status: 400 },
      );
    if (/주민등록|진료\s*기록|복약|질병|\d{6}-?\d{7}/.test(parsed.data.text))
      return Response.json(
        {
          error:
            "의료 정보와 주민등록번호는 입력하지 마세요. 여행 취향과 걷기·휴식 조건만 써 주세요.",
        },
        { status: 400 },
      );
    const provider =
      parsed.data.consent &&
      process.env.BOPok_AI_KEY &&
      process.env.BOPok_AI_MODEL
        ? new OpenAIProvider(
            process.env.BOPok_AI_KEY,
            process.env.BOPok_AI_MODEL,
          )
        : null;
    return Response.json(await extractWithFallback(parsed.data.text, provider));
  } catch {
    return Response.json(
      { error: "입력을 확인해 주세요. 숫자는 지원 범위 안에서 입력해 주세요." },
      { status: 400 },
    );
  }
}
