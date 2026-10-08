import { test, expect, Page } from "@playwright/test";
// Each flow represents a separate client; keep the server's real request limiter enabled.
test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": `qa-${testInfo.project.name}-${testInfo.testId}`,
  });
});
async function demo(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "예시 여행 체험하기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "솔바다에서, 천천히 함께", exact: true }),
  ).toBeVisible();
}
async function improve(page: Page) {
  await page
    .getByRole("button", { name: "부모님 조건에 맞게 수정하기" })
    .click();
  await expect(
    page.getByRole("heading", { name: "같은 마음, 조금 다른 일정." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "수정안 적용", exact: true }).click();
}
test("시연 전체 흐름: 문제 점검, 비교, 적용, 부모님 의견, 재수정, 인쇄", async ({
  page,
}) => {
  await demo(page);
  await expect(
    page.getByText("연속 보행 40분:", { exact: false }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "일정 점검하기", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("다시 점검");
  await improve(page);
  await expect(
    page.getByRole("heading", { name: "정보 부족", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".timeline")).not.toContainText(
    "계단을 피하고 싶다는 조건과 맞지",
  );
  await page.getByRole("button", { name: "부모님 모드", exact: true }).click();
  await expect(page.locator(".parent-sheet")).toContainText(
    "가상 푸른창 바다쉼터",
  );
  await page
    .getByRole("button", { name: "쉬는 시간을 늘려 주세요", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("의견을 기록");
  await page.getByRole("button", { name: "자녀용 상세 화면" }).click();
  await page.getByRole("button", { name: "의견을 반영한 수정안 보기" }).click();
  await expect(page.locator(".change-reasons")).toContainText("30분");
  await page.getByRole("button", { name: "수정안 적용", exact: true }).click();
  await page.getByRole("button", { name: "부모님 모드", exact: true }).click();
  await expect(
    page.locator(".parent-item").filter({ hasText: "쉬는 시간" }).first(),
  ).toContainText("30분 쉬어요");
  await page.evaluate(() => {
    (window as any).__printed = false;
    window.print = () => {
      (window as any).__printed = true;
    };
  });
  await page.getByRole("button", { name: "인쇄 / PDF 저장" }).click();
  expect(await page.evaluate(() => (window as any).__printed)).toBe(true);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".site-header")).toBeHidden();
  await expect(page.locator(".parent-feedback")).toBeHidden();
  await expect(page.locator(".demo-banner")).toBeVisible();
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  expect(pdf.byteLength).toBeGreaterThan(10000);
});
test("새 여행: 단계 입력, 생성, 새로고침 복원, 데이터 삭제", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "우리 부모님 여행 만들기", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: /한 번에 걷고 싶은 최대 시간/ })
    .fill("20");
  await page
    .getByRole("spinbutton", { name: /한 번에 걷고 싶은 최대 거리/ })
    .fill("800");
  await page.getByRole("spinbutton", { name: /원하는 휴식 간격/ }).fill("60");
  await page
    .getByRole("spinbutton", { name: /한 번 쉴 때 원하는 시간/ })
    .fill("20");
  await page.getByRole("checkbox", { name: /계단은 반드시/ }).check();
  await page.getByRole("button", { name: "다음으로", exact: true }).click();
  await page.getByRole("button", { name: "바다 보기", exact: true }).click();
  await page
    .getByRole("textbox", { name: /피하고 싶은 음식/ })
    .fill("매운 음식");
  await page.getByRole("button", { name: "다음으로", exact: true }).click();
  await expect(page.locator(".condition-card")).toContainText("최대 20분");
  await page.getByRole("button", { name: "이 조건으로 여행 준비하기" }).click();
  await page.getByRole("button", { name: "우리 가족 일정 만들기" }).click();
  await expect(
    page.getByRole("heading", { name: "확인된 정보 기준 충족", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "이어서 보기", exact: true }).click();
  await expect(page.locator(".timeline")).toContainText("가상 푸른창 바다쉼터");
  await page.getByRole("button", { name: "내 여행 데이터 삭제" }).click();
  await expect(page.getByRole("status")).toContainText("삭제했습니다");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "이어서 보기", exact: true }),
  ).toHaveCount(0);
});
test("작성 중인 조건 초안은 새로고침 후 이어서 입력한다", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "우리 부모님 여행 만들기", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: /한 번에 걷고 싶은 최대 시간/ })
    .fill("17");
  await page.reload();
  await page.getByRole("button", { name: "입력 이어서 하기" }).click();
  await expect(
    page.getByRole("spinbutton", { name: /한 번에 걷고 싶은 최대 시간/ }),
  ).toHaveValue("17");
});
test("기존 텍스트 일정 입력, 편집 가능한 시간표, 점검", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /이미 계획한 여행이 있나요/ }).click();
  await page.getByRole("button", { name: "다음으로", exact: true }).click();
  await page.getByRole("button", { name: "다음으로", exact: true }).click();
  await page.getByRole("button", { name: "이 조건으로 여행 준비하기" }).click();
  await page
    .getByRole("textbox", { name: "1일차 텍스트 일정" })
    .fill("09:30-10:15 가상 바다마루 전망길\n14:00-14:50 가상 솔바다 매운밥집");
  await page
    .getByRole("button", { name: "텍스트를 시간표로 가져오기" })
    .click();
  await expect(page.locator(".editor-row")).toHaveCount(2);
  await page
    .getByRole("button", { name: "일정 점검하기", exact: true })
    .click();
  await expect(page.locator(".report")).toContainText("이동 구간이 빠졌습니다");
});
test("수동 편집은 재점검하고 고정 해제와 되돌리기가 작동한다", async ({
  page,
}) => {
  await demo(page);
  await improve(page);
  await page.getByRole("button", { name: "직접 수정", exact: true }).click();
  const first = page.locator(".editor-row").first();
  await first.getByRole("checkbox", { name: "이 일정 고정" }).check();
  await expect(first.getByLabel("시작", { exact: true })).toBeDisabled();
  await first.getByRole("checkbox", { name: "이 일정 고정" }).uncheck();
  await first.getByLabel("종료", { exact: true }).fill("09:00");
  await expect(page.locator(".report")).toContainText(
    "종료 시간은 시작 시간보다 늦어야",
  );
  await page.getByRole("button", { name: "이전 일정으로 되돌리기" }).click();
  await expect(page.locator(".report")).not.toContainText(
    "종료 시간은 시작 시간보다 늦어야",
  );
});
test("불가능한 걷기 조건을 자동 완화하지 않는다", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "우리 부모님 여행 만들기", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: /한 번에 걷고 싶은 최대 시간/ })
    .fill("1");
  await page.getByRole("button", { name: "다음으로", exact: true }).click();
  await page.getByRole("button", { name: "다음으로", exact: true }).click();
  await page.getByRole("button", { name: "이 조건으로 여행 준비하기" }).click();
  await page.getByRole("button", { name: "우리 가족 일정 만들기" }).click();
  await expect(page.locator(".report")).toContainText("조건 충돌");
  await page
    .getByRole("button", { name: "부모님 조건에 맞게 수정하기" })
    .click();
  await expect(
    page.getByRole("button", { name: "수정안 적용", exact: true }),
  ).toBeDisabled();
});
test("자연어 추출은 규칙 모드를 표시하고 사용자 확인 후 반영한다", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "우리 부모님 여행 만들기", exact: true })
    .click();
  await page.getByText("말로 적는 편이 더 편한가요?", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "부모님의 여행 이야기" })
    .fill(
      "한 번에 20분 걷고 싶어요. 바다를 보고 싶어요. 매운 음식은 피하고 싶어요.",
    );
  await page
    .getByRole("button", { name: "조건 추출하기", exact: true })
    .click();
  await expect(page.locator(".extraction")).toContainText("규칙 기반 시연");
  await expect(
    page.getByRole("spinbutton", { name: /한 번에 걷고 싶은 최대 시간/ }),
  ).toHaveValue("");
  await page.getByRole("button", { name: "확인 후 조건 카드에 반영" }).click();
  await expect(
    page.getByRole("spinbutton", { name: /한 번에 걷고 싶은 최대 시간/ }),
  ).toHaveValue("20");
});
test("늦게 도착한 AI 응답이 수정한 조건을 덮어쓰지 않는다", async ({
  page,
}) => {
  await page.route("**/api/conditions", async (route) => {
    await new Promise((r) => setTimeout(r, 200));
    await route.fulfill({
      json: {
        status: "rules",
        message: "old",
        output: {
          maxWalkMin: 20,
          maxWalkM: null,
          restInterval: null,
          restMin: null,
          avoidStairs: null,
          foodAvoids: [],
          experiences: [],
          questions: [],
          placeIds: [],
          evidenceIds: [],
        },
      },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "우리 부모님 여행 만들기", exact: true })
    .click();
  await page.getByText("말로 적는 편이 더 편한가요?", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "부모님의 여행 이야기" })
    .fill("한 번에 20분");
  await page.getByRole("button", { name: "조건 추출하기" }).click();
  await page
    .getByRole("spinbutton", { name: /한 번에 걷고 싶은 최대 시간/ })
    .fill("15");
  await expect(page.locator(".extraction")).toHaveCount(0);
  await expect(
    page.getByRole("spinbutton", { name: /한 번에 걷고 싶은 최대 시간/ }),
  ).toHaveValue("15");
});
test("빈 상태·손상된 저장소·없는 여행 경로를 처리한다", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("bopok:trip:v1", "{broken"),
  );
  await page.goto("/");
  await expect(page.locator(".alert.error")).toContainText("읽지 못했습니다");
  await expect(
    page.getByRole("button", { name: "이어서 보기", exact: true }),
  ).toHaveCount(0);
  await page.goto("/travel/not-existing");
  await expect(
    page.getByRole("heading", { name: "이 여행을 찾을 수 없어요." }),
  ).toBeVisible();
});
test("모바일 오버플로 없이 키보드로 본문에 접근한다", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "본문 바로가기" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await demo(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("서버 입력 오류와 의료 정보 입력을 거절한다", async ({
  request,
}, testInfo) => {
  for (const body of [
    { text: "", consent: false },
    { text: "질병과 복약 내역", consent: false },
    { text: "x".repeat(1801), consent: false },
  ]) {
    const response = await request.post("/api/conditions", {
      data: body,
      headers: { "x-forwarded-for": `qa-input-${testInfo.project.name}` },
    });
    expect(response.status()).toBe(400);
  }
});
test("서버는 동일 클라이언트의 11번째 요청을 제한한다", async ({
  request,
}, testInfo) => {
  const headers = { "x-forwarded-for": `qa-rate-${testInfo.project.name}` };
  for (let n = 0; n < 10; n++)
    expect(
      (
        await request.post("/api/conditions", {
          data: { text: "한 번에 20분", consent: false },
          headers,
        })
      ).status(),
    ).toBe(200);
  expect(
    (
      await request.post("/api/conditions", {
        data: { text: "한 번에 20분", consent: false },
        headers,
      })
    ).status(),
  ).toBe(429);
});
test("브라우저 저장소 접근 자체가 거절되어도 시연을 계속한다", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Denied", "SecurityError");
      },
    }),
  );
  await page.goto("/");
  await expect(page.locator(".alert.error")).toContainText(
    "저장소에 접근할 수 없습니다",
  );
  await page
    .getByRole("button", { name: "예시 여행 체험하기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "솔바다에서, 천천히 함께", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".alert.error")).toContainText(
    "저장하지 못했습니다",
  );
});
