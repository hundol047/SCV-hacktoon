import Link from "next/link";
export default function NotFound() {
  return (
    <main className="empty">
      <h1>이 여행을 찾을 수 없어요.</h1>
      <p>여행은 저장한 브라우저에서만 볼 수 있습니다.</p>
      <Link href="/">보폭 홈으로 돌아가기</Link>
    </main>
  );
}
