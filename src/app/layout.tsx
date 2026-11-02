import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "여행잇 — AI 기반 지역 맞춤형 여행코스 추천",
  description:
    "지역과 취향, 택시·자가용 이동과 보행 조건을 반영한 맞춤 여행코스. AI 추천과 기본 추천을 비교하고 나만의 일정을 만드세요.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
