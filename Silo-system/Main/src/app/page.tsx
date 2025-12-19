"use client";

import {
  AltNavigation,
  AltHero,
  AltHeroAr,
  AltFeatures,
  AltTestimonials,
  AltPricing,
  AltCTA,
  AltFooter,
} from "@/components/alt";
import HowItWorks from "@/components/HowItWorks";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";

function HomeContent() {
  const { isArabic } = useLanguage();

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 transition-colors duration-300">
      <AltNavigation />
      {isArabic ? <AltHeroAr /> : <AltHero />}
      <AltFeatures />
      <HowItWorks />
      <AltTestimonials />
      <AltPricing />
      <AltCTA />
      <AltFooter />
    </main>
  );
}

export default function Home() {
  return (
    <LanguageProvider>
      <HomeContent />
    </LanguageProvider>
  );
}
