"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, ArrowUpLeft, Check } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const benefitsEn = [
  "No credit card required",
  "Setup in under 1 hour",
  "Cancel anytime",
];

const benefitsAr = [
  "لا حاجة لبطاقة ائتمان",
  "إعداد في أقل من ساعة",
  "إلغاء في أي وقت",
];

const textContent = {
  en: {
    badge: "Limited: 30-Day Free Trial",
    title1: "Ready to transform",
    title2: "your restaurant?",
    description: "Join hundreds of restaurant owners who have already streamlined their operations with Sylo.",
    cta1: "Start Free Trial",
    cta2: "Schedule Demo",
  },
  ar: {
    badge: "عرض محدود: تجربة مجانية لمدة ٣٠ يومًا",
    title1: "هل أنت مستعد لتحويل",
    title2: "مطعمك؟",
    description: "انضم إلى مئات أصحاب المطاعم الذين قاموا بالفعل بتبسيط عملياتهم مع Sylo.",
    cta1: "ابدأ تجربة مجانية",
    cta2: "حدد موعد عرض توضيحي",
  },
};

export default function AltCTA() {
  const { isArabic } = useLanguage();
  
  const benefits = isArabic ? benefitsAr : benefitsEn;
  const text = isArabic ? textContent.ar : textContent.en;
  const ArrowIcon = isArabic ? ArrowUpLeft : ArrowUpRight;

  return (
    <section id="contact" className="relative py-32 bg-white dark:bg-zinc-950 overflow-hidden transition-colors duration-300" dir={isArabic ? "rtl" : "ltr"}>
      <div className="relative z-10 max-w-5xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative"
        >
          {/* Main CTA Card */}
          <div className="relative bg-gray-50 dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden border-2 border-gray-100 dark:border-zinc-800">
            {/* Content */}
            <div className="relative z-10 px-8 py-16 sm:px-16 sm:py-20 lg:px-24 lg:py-28">
              <div className="max-w-2xl mx-auto text-center">
                {/* Badge */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-full mb-8 shadow-sm"
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-2 h-2 bg-black dark:bg-white rounded-full"
                  />
                  <span 
                    className="text-sm font-medium text-gray-700 dark:text-zinc-300"
                    style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                  >
                    {text.badge}
                  </span>
                </motion.div>

                {/* Headline */}
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black dark:text-white mb-6 leading-tight"
                  style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "Syne, sans-serif" }}
                >
                  {text.title1}
                  <br />
                  <span className="text-gray-400 dark:text-zinc-500">{text.title2}</span>
                </motion.h2>

                {/* Description */}
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 }}
                  className="text-lg text-gray-500 dark:text-zinc-400 mb-10 max-w-lg mx-auto"
                  style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                >
                  {text.description}
                </motion.p>

                {/* CTA Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 }}
                  className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
                >
                  <motion.a
                    href="#"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="group inline-flex items-center gap-2 px-8 py-4 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-full hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors shadow-lg"
                    style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                  >
                    {text.cta1}
                    <ArrowIcon className={`w-5 h-5 ${isArabic ? "group-hover:-translate-x-0.5" : "group-hover:translate-x-0.5"} group-hover:-translate-y-0.5 transition-transform`} />
                  </motion.a>
                  <motion.a
                    href="#"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="inline-flex items-center gap-2 px-8 py-4 border-2 border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-zinc-300 font-semibold rounded-full hover:border-gray-900 dark:hover:border-white hover:text-black dark:hover:text-white transition-colors"
                    style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                  >
                    {text.cta2}
                  </motion.a>
                </motion.div>

                {/* Benefits */}
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6 }}
                  className="flex flex-wrap items-center justify-center gap-6"
                >
                  {benefits.map((benefit) => (
                    <div
                      key={benefit}
                      className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400"
                      style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                    >
                      <div className="w-4 h-4 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-gray-700 dark:text-zinc-300" />
                      </div>
                      {benefit}
                    </div>
                  ))}
                </motion.div>
              </div>
            </div>

            {/* Decorative corners */}
            <div className="absolute top-8 left-8 w-12 h-12 border-l-2 border-t-2 border-gray-200 dark:border-zinc-700 rounded-tl-2xl" />
            <div className="absolute top-8 right-8 w-12 h-12 border-r-2 border-t-2 border-gray-200 dark:border-zinc-700 rounded-tr-2xl" />
            <div className="absolute bottom-8 left-8 w-12 h-12 border-l-2 border-b-2 border-gray-200 dark:border-zinc-700 rounded-bl-2xl" />
            <div className="absolute bottom-8 right-8 w-12 h-12 border-r-2 border-b-2 border-gray-200 dark:border-zinc-700 rounded-br-2xl" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
