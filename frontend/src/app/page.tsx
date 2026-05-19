"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import { Hero, type HeroStartPayload } from "@/components/design/Hero";
import {
  Categories,
  type CategoryItem,
  type CategoryKey,
} from "@/components/design/Categories";
import { ProPaths, type ProPathKey } from "@/components/design/ProPaths";
import { WhyKyeol } from "@/components/design/WhyKyeol";
import {
  ComingSoonModal,
  type ComingSoonMode,
} from "@/components/design/ComingSoonModal";

// 라이프 컨텍스트 → 라우트 매핑
const CATEGORY_ROUTES: Record<CategoryKey, string | null> = {
  baby: "/search",
  rename: "/search?mode=rename", // TODO: /rename 라우트 신설 시 변경
  company: null, // Coming Soon
  pet: null, // Coming Soon
};

const PROPATH_ROUTES: Record<ProPathKey, string> = {
  evaluate: "/evaluate",
  twin: "/twin",
  parent: "/parent-based",
  rare: "/rare-surname",
  dual: "/dual-name",
  required: "/required-char",
};

export default function HomePage() {
  const router = useRouter();
  const [comingSoonMode, setComingSoonMode] = useState<ComingSoonMode | null>(
    null
  );

  function handleHeroStart(payload: HeroStartPayload) {
    if (payload.mode === "recommend") {
      const params = new URLSearchParams();
      if (payload.lastName) params.set("lastName", payload.lastName);
      if (payload.birth) params.set("birthDate", payload.birth);
      if (payload.birthTime) params.set("birthTime", payload.birthTime);
      if (payload.gender && payload.gender !== "any")
        params.set("gender", payload.gender);
      if (payload.tone) params.set("tone", payload.tone);
      if (payload.parentName) params.set("parentName", payload.parentName);
      if (payload.story) params.set("story", payload.story);
      if (payload.englishName) params.set("englishName", payload.englishName);
      // 성씨가 들어왔으면 자동 제출까지 진행 (Hero에서 한 번에 결과 확인)
      if (payload.lastName) params.set("autoStart", "1");
      const qs = params.toString();
      router.push(qs ? `/search?${qs}` : "/search");
    } else {
      const params = new URLSearchParams();
      if (payload.name) {
        // "김서준"처럼 성+이름 한 덩어리로 들어옴 → split
        const lastName = payload.name.charAt(0);
        const firstName = payload.name.slice(1);
        params.set("lastName", lastName);
        if (firstName) params.set("name", firstName);
      }
      if (payload.birth) params.set("birthDate", payload.birth);
      if (payload.birthTime) params.set("birthTime", payload.birthTime);
      // Hero가 recommend/evaluate 모두 "any"를 sentinel로 사용 → 통일된 처리
      if (payload.gender && payload.gender !== "any" && payload.gender !== "none")
        params.set("gender", payload.gender);
      if (payload.tone) params.set("tone", payload.tone);
      router.push(`/evaluate?${params.toString()}`);
    }
  }

  function handleCategorySelect(key: CategoryKey) {
    const route = CATEGORY_ROUTES[key];
    if (route) router.push(route);
  }

  function handleCategoryNotify(item: CategoryItem) {
    if (item.key === "company" || item.key === "pet") {
      setComingSoonMode(item.key);
    }
  }

  function handleProPathSelect(key: ProPathKey) {
    router.push(PROPATH_ROUTES[key]);
  }

  return (
    <>
      <Header current="home" />

      <main>
        <Hero onStart={handleHeroStart} />
        <Categories
          onSelect={handleCategorySelect}
          onNotify={handleCategoryNotify}
        />
        <ProPaths onSelect={handleProPathSelect} />
        <WhyKyeol />
      </main>

      <Footer />

      {comingSoonMode && (
        <ComingSoonModal
          mode={comingSoonMode}
          open={true}
          onClose={() => setComingSoonMode(null)}
        />
      )}
    </>
  );
}
