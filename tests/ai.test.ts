import { it, expect, vi } from "vitest";
import {
  RulesProvider,
  OpenAIProvider,
  extractionSchema,
  validateExtraction,
  extractWithFallback,
} from "../src/adapters/ai";
it("AI가 원문에 없는 보행 수치를 만들면 거절한다 (모의 응답)", async () => {
  const output = {
    ...(await new RulesProvider().extract("한 번에 20분")),
    maxWalkMin: 30,
  };
  const fetcher = (async () =>
    new Response(
      JSON.stringify({
        output: [
          { content: [{ type: "output_text", text: JSON.stringify(output) }] },
        ],
      }),
    )) as typeof fetch;
  const p = new OpenAIProvider("test", "configured-model", fetcher);
  expect((await extractWithFallback("한 번에 20분", p)).status).toBe(
    "fallback",
  );
});
it("요청에서 제공하지 않은 후보 ID는 유효한 데이터 ID여도 거절한다", async () => {
  const output = {
    ...(await new RulesProvider().extract("한 번에 20분")),
    placeIds: ["p02"],
  };
  const fetcher = (async () =>
    new Response(
      JSON.stringify({
        output: [
          { content: [{ type: "output_text", text: JSON.stringify(output) }] },
        ],
      }),
    )) as typeof fetch;
  const p = new OpenAIProvider("test", "configured-model", fetcher);
  expect((await extractWithFallback("한 번에 20분", p)).status).toBe(
    "fallback",
  );
});
it("명시된 걷기 시간·경험·회피 음식만 추출한다", async () => {
  const o = await new RulesProvider().extract(
    "한 번 걸을 때는 20분 정도면 좋겠고 바다를 보고 싶어요. 매운 음식은 피하고 싶어요.",
  );
  expect(o.maxWalkMin).toBe(20);
  expect(o.maxWalkM).toBeNull();
  expect(o.foodAvoids).toEqual(["매운 음식"]);
  expect(o.experiences).toEqual(["바다 보기"]);
});
it("나이·모호한 문장으로 보행 수치를 만들지 않는다", async () => {
  const o = await new RulesProvider().extract(
    "70세이고 천천히 걷고 싶어요. 충분히 쉬고 싶어요.",
  );
  expect(o.maxWalkMin).toBeNull();
  expect(o.restMin).toBeNull();
  expect(o.questions.length).toBeGreaterThan(0);
});
it("빈 구조·누락된 AI 필드를 거절한다", () =>
  expect(() => validateExtraction({})).toThrow());
it("과도한 숫자를 포함한 AI 결과를 거절한다", async () => {
  const out = await new RulesProvider().extract("바다 보기");
  expect(() => validateExtraction({ ...out, maxWalkMin: 999 })).toThrow();
});
it("존재하지 않는 장소 ID를 거절한다", async () => {
  const out = await new RulesProvider().extract("바다 보기");
  expect(() =>
    validateExtraction({ ...out, placeIds: ["invented"] }),
  ).toThrow();
});
it("존재하지 않는 근거 ID를 거절한다", async () => {
  const out = await new RulesProvider().extract("바다 보기");
  expect(() => validateExtraction({ ...out, evidenceIds: ["fake"] })).toThrow();
});
it("키가 없으면 외부 호출 없이 규칙 기반으로 동작한다", async () => {
  expect((await extractWithFallback("한 번에 20분", null)).status).toBe(
    "rules",
  );
});
it("공급자 실패를 표시하고 규칙 기반으로 대체한다", async () => {
  const r = await extractWithFallback("한 번에 20분", {
    extract: async () => {
      throw Error("network");
    },
  });
  expect(r.status).toBe("fallback");
  expect(r.output.maxWalkMin).toBe(20);
});
it("실제 어댑터가 잘못된 JSON을 반환하면 대체한다 (모의 응답)", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          output: [{ content: [{ type: "output_text", text: "not-json" }] }],
        }),
      ),
  );
  const p = new OpenAIProvider(
    "test",
    "configured-model",
    fetcher as typeof fetch,
  );
  expect((await extractWithFallback("바다 보기", p)).status).toBe("fallback");
});
it("AI 요청 타임아웃 후 대체한다 (외부 API 미호출)", async () => {
  const fetcher = ((_url: unknown, init: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(Error("aborted")));
    })) as typeof fetch;
  const p = new OpenAIProvider("test", "configured-model", fetcher, 5);
  expect((await extractWithFallback("바다 보기", p)).status).toBe("fallback");
});
it("Responses 구조화 출력 요청을 만들고 검증한다 (모의 응답)", async () => {
  const output = await new RulesProvider().extract("한 번에 20분");
  let requestBody: any;
  const fetcher = vi.fn(async (_url: unknown, init: RequestInit) => {
    requestBody = JSON.parse(init.body as string);
    return new Response(
      JSON.stringify({
        output: [
          { content: [{ type: "output_text", text: JSON.stringify(output) }] },
        ],
      }),
    );
  });
  const p = new OpenAIProvider(
    "test",
    "configured-model",
    fetcher as typeof fetch,
  );
  expect((await extractWithFallback("한 번에 20분", p)).status).toBe(
    "connected",
  );
  expect(requestBody.store).toBe(false);
  expect(requestBody.text.format.type).toBe("json_schema");
  expect(requestBody.text.format.strict).toBe(true);
});
