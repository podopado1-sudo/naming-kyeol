/**
 * /name/[이름] X(트위터) 공유 카드 — OG 카드와 동일 이미지를 twitter:image로 노출.
 *
 * 루트 layout의 twitter.images(/og-image.png)는 페이지 generateMetadata의
 * twitter 오버라이드(shallow merge로 통째 대체)가 걷어내고, 이 파일 컨벤션이
 * 이름별 twitter:image 메타를 주입한다. 렌더 구현·정적 생성 파라미터는
 * opengraph-image.tsx를 그대로 재수출(카드 1종 유지, 별도 렌더 경로 없음).
 */
export {
  default,
  alt,
  size,
  contentType,
  generateStaticParams,
} from "./opengraph-image";

// 세그먼트 설정은 정적 파싱 대상이라 재수출 불가(빌드 에러) — 파일마다 직접 선언.
// 없으면 미생성 slug(드립 미공개 이름·임의 문자열)가 404 대신 온디맨드 렌더된다.
export const dynamicParams = false;
