"use client";

import { motion } from "framer-motion";
import { Check, ArrowUpRight, ArrowUpLeft, Sparkles } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const plansEn = [
  {
    name: "Starter",
    description: "For single-location restaurants",
    price: "99",
    period: "/month",
    features: [
      "1 Branch",
      "Up to 10 Users",
      "POS System",
      "Basic Inventory",
      "Employee Scheduling",
      "Email Support",
    ],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Professional",
    description: "For growing multi-location businesses",
    price: "249",
    period: "/month",
    features: [
      "Up to 5 Branches",
      "Unlimited Users",
      "Full POS + Kitchen Display",
      "Advanced Inventory & Recipes",
      "HR & Payroll Integration",
      "Operations Checklists",
      "AI Analytics & Reports",
      "Priority Support",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    description: "For large chains with custom needs",
    price: "Custom",
    period: "",
    features: [
      "Unlimited Branches",
      "Unlimited Users",
      "All Professional Features",
      "Custom Integrations",
      "Dedicated Account Manager",
      "On-site Training",
      "SLA Guarantee",
      "Custom AI Models",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

const plansAr = [
  {
    name: "المبتدئ",
    description: "للمطاعم ذات الموقع الواحد",
    price: "٩٩",
    period: "/شهر",
    features: [
      "فرع واحد",
      "حتى ١٠ مستخدمين",
      "نظام نقاط البيع",
      "مخزون أساسي",
      "جدولة الموظفين",
      "دعم بالبريد الإلكتروني",
    ],
    cta: "ابدأ تجربة مجانية",
    popular: false,
  },
  {
    name: "الاحترافي",
    description: "للأعمال متعددة الفروع النامية",
    price: "٢٤٩",
    period: "/شهر",
    features: [
      "حتى ٥ فروع",
      "مستخدمين غير محدودين",
      "نقاط بيع + شاشة مطبخ كاملة",
      "مخزون ووصفات متقدمة",
      "تكامل الموارد البشرية والرواتب",
      "قوائم مهام العمليات",
      "تحليلات وتقارير الذكاء الاصطناعي",
      "دعم ذو أولوية",
    ],
    cta: "ابدأ تجربة مجانية",
    popular: true,
  },
  {
    name: "المؤسسات",
    description: "للسلاسل الكبيرة ذات الاحتياجات المخصصة",
    price: "مخصص",
    period: "",
    features: [
      "فروع غير محدودة",
      "مستخدمين غير محدودين",
      "جميع ميزات الخطة الاحترافية",
      "تكاملات مخصصة",
      "مدير حساب مخصص",
      "تدريب في الموقع",
      "ضمان اتفاقية مستوى الخدمة",
      "نماذج ذكاء اصطناعي مخصصة",
    ],
    cta: "تواصل مع المبيعات",
    popular: false,
  },
];

const textContent = {
  en: {
    badge: "Pricing",
    title1: "Simple,",
    title2: "transparent pricing",
    description: "No hidden fees. No long-term contracts. Start small and scale as you grow.",
    popular: "Most Popular",
    bottomNote: "All plans include 30-day free trial • No credit card required •",
    questions: "Questions? Contact us",
  },
  ar: {
    badge: "الأسعار",
    title1: "تسعير",
    title2: "بسيط وشفاف",
    description: "لا رسوم خفية. لا عقود طويلة الأجل. ابدأ صغيرًا وتوسع مع نموك.",
    popular: "الأكثر شيوعًا",
    bottomNote: "جميع الخطط تشمل تجربة مجانية لمدة ٣٠ يومًا • لا حاجة لبطاقة ائتمان •",
    questions: "أسئلة؟ تواصل معنا",
  },
};

export default function AltPricing() {
  const { isArabic } = useLanguage();
  
  const plans = isArabic ? plansAr : plansEn;
  const text = isArabic ? textContent.ar : textContent.en;
  const ArrowIcon = isArabic ? ArrowUpLeft : ArrowUpRight;

  return (
    <section id="pricing" className="relative py-32 bg-white dark:bg-zinc-950 overflow-hidden transition-colors duration-300" dir={isArabic ? "rtl" : "ltr"}>
      {/* Background decoration */}
      <div className="absolute inset-0">
        <div className={`absolute top-0 ${isArabic ? "right-0" : "left-0"} w-1/3 h-full bg-white dark:bg-zinc-950`} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl mb-20"
        >
          <span 
            className={`inline-block text-sm font-medium ${isArabic ? "tracking-wide" : "tracking-[0.2em] uppercase"} text-gray-500 dark:text-zinc-500 mb-4`}
            style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
          >
            {text.badge}
          </span>
          <h2
            className="text-5xl lg:text-6xl font-bold text-black dark:text-white mb-6"
            style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "Syne, sans-serif" }}
          >
            {text.title1}
            <br />
            <span className="text-gray-300 dark:text-zinc-700">{text.title2}</span>
          </h2>
          <p 
            className="text-lg text-gray-500 dark:text-zinc-400"
            style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
          >
            {text.description}
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              className={`relative group ${
                plan.popular ? "lg:-mt-8 lg:mb-8" : ""
              }`}
            >
              <div
                className={`relative h-full rounded-3xl p-8 lg:p-10 transition-all duration-300 bg-white dark:bg-zinc-900 border-2 ${
                  plan.popular
                    ? "border-gray-900 dark:border-white shadow-2xl"
                    : "border-gray-100 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600 hover:shadow-xl"
                }`}
              >
                {/* Popular badge */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <motion.div
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.5, type: "spring" }}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold rounded-full shadow-lg"
                      style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                    >
                      <Sparkles className="w-4 h-4" />
                      {text.popular}
                    </motion.div>
                  </div>
                )}

                {/* Plan name & description */}
                <div className="mb-8">
                  <h3
                    className="text-2xl font-bold mb-2 text-black dark:text-white"
                    style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "Syne, sans-serif" }}
                  >
                    {plan.name}
                  </h3>
                  <p 
                    className="text-sm text-gray-500 dark:text-zinc-400"
                    style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                  >
                    {plan.description}
                  </p>
                </div>

                {/* Price */}
                <div className="mb-8">
                  <div className="flex items-baseline gap-1">
                    {plan.price !== "Custom" && plan.price !== "مخصص" && !isArabic && (
                      <span className="text-gray-500 dark:text-zinc-400">$</span>
                    )}
                    <span
                      className="text-6xl font-bold text-black dark:text-white"
                      style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "Syne, sans-serif" }}
                    >
                      {plan.price}
                    </span>
                    {plan.price !== "Custom" && plan.price !== "مخصص" && !isArabic && (
                      <span className="text-gray-500 dark:text-zinc-400">{plan.period}</span>
                    )}
                    {plan.price !== "Custom" && plan.price !== "مخصص" && isArabic && (
                      <span className="text-gray-500 dark:text-zinc-400">$ {plan.period}</span>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px mb-8 bg-gray-100 dark:bg-zinc-800" />

                {/* Features */}
                <ul className="space-y-4 mb-10">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          plan.popular ? "bg-black dark:bg-white" : "bg-gray-100 dark:bg-zinc-800"
                        }`}
                      >
                        <Check
                          className={`w-3 h-3 ${
                            plan.popular ? "text-white dark:text-black" : "text-black dark:text-white"
                          }`}
                        />
                      </div>
                      <span 
                        className="text-gray-600 dark:text-zinc-300"
                        style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <motion.a
                  href="#contact"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center justify-center gap-2 w-full py-4 rounded-full font-semibold transition-all duration-300 ${
                    plan.popular
                      ? "bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-zinc-200"
                      : "bg-gray-100 dark:bg-zinc-800 text-black dark:text-white hover:bg-gray-200 dark:hover:bg-zinc-700"
                  }`}
                  style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                >
                  {plan.cta}
                  <ArrowIcon className="w-4 h-4" />
                </motion.a>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-12 text-gray-500 dark:text-zinc-400"
          style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
        >
          {text.bottomNote}{" "}
          <a href="#contact" className="text-black dark:text-white hover:underline">
            {text.questions}
          </a>
        </motion.p>
      </div>
    </section>
  );
}
