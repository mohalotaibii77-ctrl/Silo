"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const testimonialsEn = [
  {
    name: "Sarah Al-Rashid",
    role: "Owner, Café Arabica",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face",
    content:
      "Sylo transformed how we manage our 5 locations. The real-time inventory sync alone saved us thousands in waste reduction. The AI predictions are scary accurate!",
    highlight: "saved thousands in waste reduction",
  },
  {
    name: "Mohammed Hassan",
    role: "Operations Director, Grill House",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
    content:
      "Finally, one platform that actually works. No more switching between 6 different apps. Our team adopted it in days, not months.",
    highlight: "adopted it in days, not months",
  },
  {
    name: "Fatima Al-Khaldi",
    role: "GM, Fresh Bites Chain",
    image:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
    content:
      "The compliance features are a lifesaver. QHSE checklists, incident tracking, training modules—everything auditors ask for is just a click away.",
    highlight: "everything auditors ask for",
  },
];

const testimonialsAr = [
  {
    name: "سارة الراشد",
    role: "مالكة، مقهى أرابيكا",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face",
    content:
      "غيّر Sylo طريقة إدارتنا لـ 5 فروع. مزامنة المخزون الفورية وحدها وفرت لنا آلافًا في تقليل الهدر. توقعات الذكاء الاصطناعي دقيقة بشكل مذهل!",
    highlight: "وفرت لنا آلافًا في تقليل الهدر",
  },
  {
    name: "محمد حسن",
    role: "مدير العمليات، جريل هاوس",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
    content:
      "أخيرًا، منصة واحدة تعمل بالفعل. لا مزيد من التنقل بين 6 تطبيقات مختلفة. فريقنا اعتمدها في أيام، وليس أشهر.",
    highlight: "اعتمدها في أيام، وليس أشهر",
  },
  {
    name: "فاطمة الخالدي",
    role: "المديرة العامة، سلسلة فريش بايتس",
    image:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
    content:
      "ميزات الامتثال منقذة للحياة. قوائم الجودة والصحة والسلامة، تتبع الحوادث، وحدات التدريب—كل ما يطلبه المدققون على بعد نقرة واحدة.",
    highlight: "كل ما يطلبه المدققون",
  },
];

const textContent = {
  en: {
    badge: "Testimonials",
    title1: "Loved by",
    title2: "restaurant owners",
    trusted: "Trusted by leading brands",
    brands: ["Brand One", "Brand Two", "Brand Three", "Brand Four", "Brand Five"],
  },
  ar: {
    badge: "آراء العملاء",
    title1: "محبوب من",
    title2: "أصحاب المطاعم",
    trusted: "موثوق من العلامات التجارية الرائدة",
    brands: ["علامة تجارية ١", "علامة تجارية ٢", "علامة تجارية ٣", "علامة تجارية ٤", "علامة تجارية ٥"],
  },
};

export default function AltTestimonials() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const { isArabic } = useLanguage();
  
  const testimonials = isArabic ? testimonialsAr : testimonialsEn;
  const text = isArabic ? textContent.ar : textContent.en;

  useEffect(() => {
    const interval = setInterval(() => {
      setDirection(isArabic ? -1 : 1);
      setActiveIndex((prev) => (prev + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isArabic, testimonials.length]);

  const navigate = (dir: number) => {
    setDirection(dir);
    setActiveIndex((prev) => {
      if (dir === 1) return (prev + 1) % testimonials.length;
      return prev === 0 ? testimonials.length - 1 : prev - 1;
    });
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 200 : -200,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 200 : -200,
      opacity: 0,
    }),
  };

  return (
    <section className="relative py-32 bg-white dark:bg-zinc-950 overflow-hidden transition-colors duration-300" dir={isArabic ? "rtl" : "ltr"}>
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-gray-50 dark:from-zinc-900 to-transparent" />
      
      {/* Large quote mark */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none">
        <Quote className={`w-32 h-32 text-gray-100 dark:text-zinc-800 ${isArabic ? "scale-x-[-1]" : ""}`} strokeWidth={1} />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <span 
            className={`inline-block text-sm font-medium ${isArabic ? "tracking-wide" : "tracking-[0.2em] uppercase"} text-gray-500 dark:text-zinc-500 mb-4`}
            style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
          >
            {text.badge}
          </span>
          <h2
            className="text-5xl lg:text-6xl font-bold text-black dark:text-white"
            style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "Syne, sans-serif" }}
          >
            {text.title1}
            <br />
            <span className="text-gray-300 dark:text-zinc-700">{text.title2}</span>
          </h2>
        </motion.div>

        {/* Testimonial Carousel */}
        <div className="relative">
          <div className="overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={activeIndex}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20"
              >
                {/* Image */}
                <div className="relative flex-shrink-0">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="relative"
                  >
                    <div className="w-48 h-48 lg:w-64 lg:h-64 rounded-3xl overflow-hidden">
                      <img
                        src={testimonials[activeIndex].image}
                        alt={testimonials[activeIndex].name}
                        className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                      />
                    </div>
                    {/* Decorative frame */}
                    <div className="absolute -inset-3 border-2 border-gray-200 dark:border-zinc-700 rounded-3xl -z-10" />
                    <div className="absolute -inset-6 border border-gray-100 dark:border-zinc-800 rounded-3xl -z-20" />
                  </motion.div>
                </div>

                {/* Content */}
                <div className={`flex-1 text-center ${isArabic ? "lg:text-right" : "lg:text-left"}`}>
                  <blockquote 
                    className="text-2xl lg:text-3xl text-gray-700 dark:text-zinc-300 leading-relaxed mb-8"
                    style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                  >
                    &ldquo;{testimonials[activeIndex].content.split(testimonials[activeIndex].highlight)[0]}
                    <span className="text-black dark:text-white font-semibold">
                      {testimonials[activeIndex].highlight}
                    </span>
                    {testimonials[activeIndex].content.split(testimonials[activeIndex].highlight)[1]}&rdquo;
                  </blockquote>
                  <div>
                    <p
                      className="text-xl font-bold text-black dark:text-white"
                      style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "Syne, sans-serif" }}
                    >
                      {testimonials[activeIndex].name}
                    </p>
                    <p 
                      className="text-gray-500 dark:text-zinc-400"
                      style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                    >
                      {testimonials[activeIndex].role}
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className={`flex items-center justify-center ${isArabic ? "lg:justify-end" : "lg:justify-start"} gap-4 mt-12`}>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate(isArabic ? 1 : -1)}
              className="w-12 h-12 rounded-full border-2 border-gray-200 dark:border-zinc-700 flex items-center justify-center text-gray-600 dark:text-zinc-400 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white transition-colors"
            >
              {isArabic ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </motion.button>
            
            {/* Progress dots */}
            <div className="flex items-center gap-2 mx-4">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setDirection(index > activeIndex ? (isArabic ? -1 : 1) : (isArabic ? 1 : -1));
                    setActiveIndex(index);
                  }}
                  className="relative w-8 h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-zinc-700"
                >
                  <motion.div
                    initial={false}
                    animate={{
                      width: index === activeIndex ? "100%" : "0%",
                    }}
                    transition={{ duration: index === activeIndex ? 6 : 0.3 }}
                    className={`absolute inset-y-0 ${isArabic ? "right-0" : "left-0"} bg-black dark:bg-white`}
                  />
                </button>
              ))}
            </div>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate(isArabic ? -1 : 1)}
              className="w-12 h-12 rounded-full border-2 border-gray-200 dark:border-zinc-700 flex items-center justify-center text-gray-600 dark:text-zinc-400 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white transition-colors"
            >
              {isArabic ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </motion.button>
          </div>
        </div>

        {/* Brand logos */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-24 pt-16 border-t border-gray-100 dark:border-zinc-800"
        >
          <p 
            className={`text-center text-sm text-gray-400 dark:text-zinc-600 ${isArabic ? "tracking-wide" : "uppercase tracking-[0.2em]"} mb-8`}
            style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
          >
            {text.trusted}
          </p>
          <div className="flex flex-wrap justify-center items-center gap-x-16 gap-y-8">
            {text.brands.map(
              (brand) => (
                <span
                  key={brand}
                  className="text-xl font-bold text-gray-200 dark:text-zinc-700 hover:text-gray-400 dark:hover:text-zinc-500 transition-colors cursor-default"
                  style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "Syne, sans-serif" }}
                >
                  {brand}
                </span>
              )
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
