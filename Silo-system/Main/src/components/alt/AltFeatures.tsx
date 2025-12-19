"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import {
  ShoppingCart,
  Package,
  Users,
  ClipboardCheck,
  Calculator,
  Brain,
  Wrench,
  GraduationCap,
  HeadphonesIcon,
  ArrowUpRight,
  ArrowUpLeft,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const featuresEn = [
  {
    icon: ShoppingCart,
    title: "Point of Sale",
    description: "Lightning-fast transactions with offline support and seamless payment processing.",
    number: "01",
  },
  {
    icon: Package,
    title: "Inventory",
    description: "Real-time tracking, automated reordering, and AI-powered waste reduction.",
    number: "02",
  },
  {
    icon: Users,
    title: "HR & Scheduling",
    description: "Smart scheduling, time tracking, and comprehensive performance analytics.",
    number: "03",
  },
  {
    icon: ClipboardCheck,
    title: "Operations",
    description: "Daily checklists, quality control, and full compliance management.",
    number: "04",
  },
  {
    icon: Calculator,
    title: "Accounting",
    description: "Automated bookkeeping, invoicing, and integrated tax reporting.",
    number: "05",
  },
  {
    icon: Brain,
    title: "AI Insights",
    description: "Predictive analytics and actionable recommendations for growth.",
    number: "06",
  },
  {
    icon: Wrench,
    title: "Maintenance",
    description: "Equipment tracking and preventive maintenance scheduling.",
    number: "07",
  },
  {
    icon: GraduationCap,
    title: "Training",
    description: "Digital training modules and certification tracking system.",
    number: "08",
  },
  {
    icon: HeadphonesIcon,
    title: "Customer Care",
    description: "Feedback collection, loyalty programs, and CRM integration.",
    number: "09",
  },
];

const featuresAr = [
  {
    icon: ShoppingCart,
    title: "نقاط البيع",
    description: "معاملات سريعة للغاية مع دعم العمل دون اتصال ومعالجة سلسة للمدفوعات.",
    number: "٠١",
  },
  {
    icon: Package,
    title: "المخزون",
    description: "تتبع فوري، إعادة طلب تلقائية، وتقليل الهدر بالذكاء الاصطناعي.",
    number: "٠٢",
  },
  {
    icon: Users,
    title: "الموارد البشرية والجدولة",
    description: "جدولة ذكية، تتبع الوقت، وتحليلات أداء شاملة.",
    number: "٠٣",
  },
  {
    icon: ClipboardCheck,
    title: "العمليات",
    description: "قوائم مهام يومية، مراقبة الجودة، وإدارة الامتثال الكاملة.",
    number: "٠٤",
  },
  {
    icon: Calculator,
    title: "المحاسبة",
    description: "مسك دفاتر آلي، فواتير، وتقارير ضريبية متكاملة.",
    number: "٠٥",
  },
  {
    icon: Brain,
    title: "تحليلات الذكاء الاصطناعي",
    description: "تحليلات تنبؤية وتوصيات قابلة للتنفيذ للنمو.",
    number: "٠٦",
  },
  {
    icon: Wrench,
    title: "الصيانة",
    description: "تتبع المعدات وجدولة الصيانة الوقائية.",
    number: "٠٧",
  },
  {
    icon: GraduationCap,
    title: "التدريب",
    description: "وحدات تدريب رقمية ونظام تتبع الشهادات.",
    number: "٠٨",
  },
  {
    icon: HeadphonesIcon,
    title: "خدمة العملاء",
    description: "جمع التعليقات، برامج الولاء، وتكامل إدارة العلاقات.",
    number: "٠٩",
  },
];

const textContent = {
  en: {
    badge: "Capabilities",
    title1: "One platform,",
    title2: "endless possibilities",
    description: "Everything you need to run your restaurant efficiently. No more switching between apps—all your operations, unified.",
    learnMore: "Learn more",
    cta: "Ready to streamline your operations?",
    ctaButton: "Explore All Features",
  },
  ar: {
    badge: "الإمكانيات",
    title1: "منصة واحدة،",
    title2: "إمكانيات لا حدود لها",
    description: "كل ما تحتاجه لإدارة مطعمك بكفاءة. لا مزيد من التنقل بين التطبيقات—جميع عملياتك، موحدة.",
    learnMore: "اعرف المزيد",
    cta: "هل أنت مستعد لتبسيط عملياتك؟",
    ctaButton: "استكشف جميع المميزات",
  },
};

export default function AltFeatures() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { isArabic } = useLanguage();
  
  const features = isArabic ? featuresAr : featuresEn;
  const text = isArabic ? textContent.ar : textContent.en;
  const ArrowIcon = isArabic ? ArrowUpLeft : ArrowUpRight;

  return (
    <section id="features" className="relative py-32 bg-white dark:bg-zinc-950 overflow-hidden transition-colors duration-300" dir={isArabic ? "rtl" : "ltr"}>
      {/* Background decoration */}
      <div className={`absolute top-0 ${isArabic ? "left-0" : "right-0"} w-1/2 h-full bg-gradient-to-l from-white dark:from-zinc-950 to-transparent`} />
      
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section Header */}
        <div className="grid lg:grid-cols-2 gap-12 mb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <span 
              className={`inline-block text-sm font-medium ${isArabic ? "tracking-wide" : "tracking-[0.2em] uppercase"} text-gray-500 dark:text-zinc-500 mb-4`}
              style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
            >
              {text.badge}
            </span>
            <h2
              className="text-5xl lg:text-6xl font-bold text-black dark:text-white leading-[1.1]"
              style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "Syne, sans-serif" }}
            >
              {text.title1}
              <br />
              <span className="text-gray-300 dark:text-zinc-700">{text.title2}</span>
            </h2>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex items-end"
          >
            <p 
              className="text-lg text-gray-500 dark:text-zinc-400 max-w-md"
              style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
            >
              {text.description}
            </p>
          </motion.div>
        </div>

        {/* Features Grid */}
        <motion.div
          ref={ref}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-200 dark:bg-zinc-800 rounded-3xl overflow-hidden"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="group relative bg-white dark:bg-zinc-950 p-8 lg:p-10 cursor-pointer"
            >
              {/* Hover background */}
              <motion.div
                initial={false}
                animate={{
                  opacity: hoveredIndex === index ? 1 : 0,
                }}
                className="absolute inset-0 bg-gray-50 dark:bg-zinc-900"
              />

              <div className="relative z-10">
                {/* Number */}
                <span className={`absolute top-0 ${isArabic ? "left-0" : "right-0"} text-6xl font-bold text-gray-100 dark:text-zinc-800 group-hover:text-gray-200 dark:group-hover:text-zinc-700 transition-colors`} style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "Syne, sans-serif" }}>
                  {feature.number}
                </span>

                {/* Icon */}
                <motion.div
                  animate={{
                    rotate: hoveredIndex === index ? (isArabic ? -12 : 12) : 0,
                    scale: hoveredIndex === index ? 1.1 : 1,
                  }}
                  transition={{ duration: 0.3 }}
                  className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-zinc-800 group-hover:bg-black dark:group-hover:bg-white flex items-center justify-center mb-6 transition-colors"
                >
                  <feature.icon className="w-6 h-6 text-gray-700 dark:text-zinc-300 group-hover:text-white dark:group-hover:text-black transition-colors" />
                </motion.div>

                {/* Content */}
                <h3
                  className="text-xl font-semibold text-black dark:text-white mb-3"
                  style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "Syne, sans-serif" }}
                >
                  {feature.title}
                </h3>
                <p 
                  className="text-gray-500 dark:text-zinc-400 leading-relaxed mb-6"
                  style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                >
                  {feature.description}
                </p>

                {/* Learn more link */}
                <motion.div
                  initial={{ opacity: 0, x: isArabic ? 10 : -10 }}
                  animate={{
                    opacity: hoveredIndex === index ? 1 : 0,
                    x: hoveredIndex === index ? 0 : (isArabic ? 10 : -10),
                  }}
                  className="flex items-center gap-2 text-sm font-medium text-black dark:text-white"
                  style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                >
                  {text.learnMore}
                  <ArrowIcon className="w-4 h-4" />
                </motion.div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-6"
        >
          <p 
            className="text-gray-500 dark:text-zinc-400"
            style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
          >
            {text.cta}
          </p>
          <motion.a
            href="#contact"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-full"
            style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
          >
            {text.ctaButton}
            <ArrowIcon className="w-4 h-4" />
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
