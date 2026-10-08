import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "보폭 — 부모님의 속도로, 함께 떠나는 여행",
  description:
    "걷는 시간부터 쉬는 순간까지, 우리 가족에게 맞게. 보폭 가상 시연 MVP.",
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
