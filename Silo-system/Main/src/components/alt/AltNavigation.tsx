"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Globe } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { ModeToggle } from "@/components/mode-toggle";
import Link from "next/link";

const navLinksEn = [
  { name: "Features", href: "#features" },
  { name: "Process", href: "#how-it-works" },
  { name: "Pricing", href: "#pricing" },
  { name: "Contact", href: "#contact" },
];

const navLinksAr = [
  { name: "المميزات", href: "#features" },
  { name: "كيف يعمل", href: "#how-it-works" },
  { name: "الأسعار", href: "#pricing" },
  { name: "تواصل معنا", href: "#contact" },
];

export default function AltNavigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { language, setLanguage, isArabic } = useLanguage();
  
  const navLinks = isArabic ? navLinksAr : navLinksEn;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.25, 0.1, 0, 1] }}
        dir={isArabic ? "rtl" : "ltr"}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled 
            ? "bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl" 
            : ""
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <motion.a
              href="#"
              className="flex items-center group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span
                className="text-2xl font-bold text-black dark:text-white tracking-tight"
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                Sylo.
              </span>
            </motion.a>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link, index) => (
                <motion.a
                  key={link.name}
                  href={link.href}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index + 0.5 }}
                  className="relative px-5 py-2 text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors group"
                >
                  {link.name}
                  <motion.span
                    className="absolute bottom-0 left-1/2 w-1 h-1 bg-black dark:bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ transform: "translateX(-50%)" }}
                  />
                </motion.a>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-3">
              {/* Theme Toggle */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65 }}
              >
                <ModeToggle />
              </motion.div>
              
              {/* Language Toggle */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                onClick={() => setLanguage(isArabic ? "en" : "ar")}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"
                style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
              >
                <Globe className="w-4 h-4" />
                <span>{isArabic ? "EN" : "عربي"}</span>
              </motion.button>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <Link
                  href="/login"
                  className="text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
                  style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                >
                  {isArabic ? "تسجيل الدخول" : "Sign In"}
                </Link>
              </motion.div>
              <motion.a
                href="#contact"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-2.5 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold rounded-full hover:bg-gray-900 dark:hover:bg-zinc-200 transition-colors"
                style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
              >
                {isArabic ? "ابدأ الآن" : "Get Started"}
              </motion.a>
            </div>

            {/* Mobile Menu Button */}
            <div className="flex md:hidden items-center gap-2">
              <ModeToggle />
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-2 text-black dark:text-white"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 md:hidden"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white dark:bg-zinc-950"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="relative h-full flex flex-col pt-24 px-6"
            >
              <div className="flex flex-col gap-2">
                {navLinks.map((link, index) => (
                  <motion.a
                    key={link.name}
                    href={link.href}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-4xl font-bold text-black dark:text-white py-3 border-b border-gray-100 dark:border-zinc-800"
                    style={{ fontFamily: "Syne, sans-serif" }}
                  >
                    {link.name}
                  </motion.a>
                ))}
              </div>
              <div className="mt-auto pb-12 space-y-4">
                {/* Mobile Language Toggle */}
                <button
                  onClick={() => {
                    setLanguage(isArabic ? "en" : "ar");
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 w-full text-gray-600 dark:text-zinc-400 font-medium py-3 hover:text-black dark:hover:text-white transition-colors"
                  style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                >
                  <Globe className="w-5 h-5" />
                  <span>{isArabic ? "Switch to English" : "التبديل إلى العربية"}</span>
                </button>
                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full text-center text-gray-600 dark:text-zinc-400 font-medium py-3"
                  style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                >
                  {isArabic ? "تسجيل الدخول" : "Sign In"}
                </Link>
                <a
                  href="#contact"
                  className="block w-full py-4 bg-black dark:bg-white text-white dark:text-black font-semibold text-center rounded-full"
                  style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                >
                  {isArabic ? "ابدأ الآن" : "Get Started"}
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
