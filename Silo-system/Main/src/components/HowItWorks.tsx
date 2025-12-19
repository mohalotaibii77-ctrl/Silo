"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import { useInView } from "framer-motion";
import { Rocket, Settings, TrendingUp, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const stepsEn = [
  {
    number: "01",
    icon: Rocket,
    title: "Quick Setup",
    description: "Sign up and configure your restaurant in minutes. Import your menu, set up branches, and invite your team.",
    shade: "#1a1a1a",
  },
  {
    number: "02",
    icon: Settings,
    title: "Customize",
    description: "Tailor the platform to your needs. Configure roles, workflows, checklists, and integrations that fit your operations.",
    shade: "#333333",
  },
  {
    number: "03",
    icon: TrendingUp,
    title: "Optimize",
    description: "Use AI-powered insights to identify inefficiencies, reduce costs, and boost revenue with data-driven decisions.",
    shade: "#4a4a4a",
  },
  {
    number: "04",
    icon: CheckCircle2,
    title: "Scale",
    description: "Expand confidently. Add new branches, employees, and features as you grow—all from a single dashboard.",
    shade: "#5a5a5a",
  },
];

const stepsAr = [
  {
    number: "٠١",
    icon: Rocket,
    title: "إعداد سريع",
    description: "سجّل وقم بتهيئة مطعمك في دقائق. استورد قائمتك، أنشئ الفروع، وادعُ فريقك.",
    shade: "#1a1a1a",
  },
  {
    number: "٠٢",
    icon: Settings,
    title: "تخصيص",
    description: "صمم المنصة حسب احتياجاتك. قم بتهيئة الأدوار، سير العمل، قوائم المهام، والتكاملات التي تناسب عملياتك.",
    shade: "#333333",
  },
  {
    number: "٠٣",
    icon: TrendingUp,
    title: "تحسين",
    description: "استخدم تحليلات الذكاء الاصطناعي لتحديد أوجه القصور، تقليل التكاليف، وزيادة الإيرادات بقرارات مبنية على البيانات.",
    shade: "#4a4a4a",
  },
  {
    number: "٠٤",
    icon: CheckCircle2,
    title: "توسع",
    description: "توسع بثقة. أضف فروعًا جديدة، موظفين، ومميزات أثناء نموك—كل ذلك من لوحة تحكم واحدة.",
    shade: "#5a5a5a",
  },
];

const textContent = {
  en: {
    badge: "Simple Process",
    title: "Get Started in",
    titleHighlight: "4 Easy Steps",
    description: "From signup to full operation in no time. Our guided onboarding ensures you're up and running without any technical headaches.",
  },
  ar: {
    badge: "عملية بسيطة",
    title: "ابدأ في",
    titleHighlight: "٤ خطوات سهلة",
    description: "من التسجيل إلى التشغيل الكامل في وقت قصير. يضمن لك التوجيه الإرشادي البدء والتشغيل دون أي تعقيدات تقنية.",
  },
};

export default function HowItWorks() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const { isArabic } = useLanguage();
  
  const steps = isArabic ? stepsAr : stepsEn;
  const text = isArabic ? textContent.ar : textContent.en;

  return (
    <section id="how-it-works" className="relative py-32 overflow-hidden transition-colors duration-300" dir={isArabic ? "rtl" : "ltr"}>
      {/* Background */}
      <div className="absolute inset-0 bg-white dark:bg-zinc-950" />
      
      {/* Decorative Line */}
      <div className="absolute left-1/2 top-40 bottom-40 w-px bg-gradient-to-b from-transparent via-gray-200 dark:via-zinc-700 to-transparent hidden lg:block" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-24"
        >
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 text-sm font-medium mb-6"
            style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
          >
            {text.badge}
          </motion.span>
          <h2 
            className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 text-gray-900 dark:text-white"
            style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "Syne, sans-serif" }}
          >
            {text.title}{" "}
            <span className="gradient-text">{text.titleHighlight}</span>
          </h2>
          <p 
            className="max-w-2xl mx-auto text-lg text-gray-500 dark:text-zinc-400"
            style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
          >
            {text.description}
          </p>
        </motion.div>

        {/* Steps */}
        <div ref={ref} className="relative">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, x: isArabic ? (index % 2 === 0 ? 50 : -50) : (index % 2 === 0 ? -50 : 50) }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.8, delay: index * 0.2 }}
              className={`flex flex-col lg:flex-row items-center gap-8 lg:gap-16 mb-20 last:mb-0 ${
                index % 2 === 1 ? "lg:flex-row-reverse" : ""
              }`}
            >
              {/* Content */}
              <div className={`flex-1 ${index % 2 === 0 ? (isArabic ? "lg:text-left" : "lg:text-right") : (isArabic ? "lg:text-right" : "lg:text-left")}`}>
                <div 
                  className="inline-block text-7xl font-bold opacity-30 mb-4 text-gray-500 dark:text-zinc-600"
                  style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "Syne, sans-serif" }}
                >
                  {step.number}
                </div>
                <h3 
                  className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4"
                  style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "Syne, sans-serif" }}
                >
                  {step.title}
                </h3>
                <p 
                  className="text-lg text-gray-500 dark:text-zinc-400 max-w-md mx-auto lg:mx-0"
                  style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                >
                  {step.description}
                </p>
              </div>

              {/* Icon */}
              <div className="relative">
                <motion.div
                  whileHover={{ scale: 1.1, rotate: isArabic ? -5 : 5 }}
                  className="w-24 h-24 rounded-3xl flex items-center justify-center relative z-10 bg-gray-100 dark:bg-zinc-800 border-2 border-gray-400 dark:border-zinc-600"
                >
                  <step.icon className="w-10 h-10 text-gray-800 dark:text-zinc-200" />
                </motion.div>
                <div 
                  className="absolute inset-0 rounded-3xl blur-2xl opacity-30 bg-gray-500 dark:bg-zinc-400"
                />
              </div>

              {/* Empty space for layout */}
              <div className="flex-1 hidden lg:block" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
