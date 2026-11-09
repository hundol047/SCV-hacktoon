import 'leaflet/dist/leaflet.css';
import type { Metadata } from "next";
import "./globals.css";
import "./lab-theme.css";
export const metadata: Metadata = {
  title: "여행잇 — 부모님과 함께하는 편안한 강원 여행",
  description:
    "부모님이나 이동이 불편한 동행자와 함께하는 강원 여행. 보행 시간, 휴식과 필요한 접근성 조건을 반영해 AI 여행코스를 계획하세요.",
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
