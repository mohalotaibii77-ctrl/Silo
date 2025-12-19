"use client";

import { motion } from "framer-motion";
import {
  Twitter,
  Linkedin,
  Instagram,
  Youtube,
  Mail,
  MapPin,
  Phone,
  ArrowUpRight,
  ArrowUpLeft,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const footerLinksEn = {
  Product: [
    { name: "Features", href: "#features" },
    { name: "Pricing", href: "#pricing" },
    { name: "Integrations", href: "#" },
    { name: "Changelog", href: "#" },
  ],
  Resources: [
    { name: "Documentation", href: "#" },
    { name: "API Reference", href: "#" },
    { name: "Blog", href: "#" },
    { name: "Help Center", href: "#" },
  ],
  Company: [
    { name: "About Us", href: "#" },
    { name: "Careers", href: "#" },
    { name: "Partners", href: "#" },
    { name: "Contact", href: "#contact" },
  ],
  Legal: [
    { name: "Privacy Policy", href: "#" },
    { name: "Terms of Service", href: "#" },
    { name: "Cookie Policy", href: "#" },
  ],
};

const footerLinksAr = {
  "المنتج": [
    { name: "المميزات", href: "#features" },
    { name: "الأسعار", href: "#pricing" },
    { name: "التكاملات", href: "#" },
    { name: "سجل التحديثات", href: "#" },
  ],
  "الموارد": [
    { name: "التوثيق", href: "#" },
    { name: "مرجع API", href: "#" },
    { name: "المدونة", href: "#" },
    { name: "مركز المساعدة", href: "#" },
  ],
  "الشركة": [
    { name: "من نحن", href: "#" },
    { name: "الوظائف", href: "#" },
    { name: "الشركاء", href: "#" },
    { name: "تواصل معنا", href: "#contact" },
  ],
  "قانوني": [
    { name: "سياسة الخصوصية", href: "#" },
    { name: "شروط الخدمة", href: "#" },
    { name: "سياسة ملفات تعريف الارتباط", href: "#" },
  ],
};

const socialLinks = [
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Linkedin, href: "#", label: "LinkedIn" },
  { icon: Instagram, href: "#", label: "Instagram" },
  { icon: Youtube, href: "#", label: "YouTube" },
];

const textContent = {
  en: {
    tagline: "The all-in-one restaurant operating system that powers modern food businesses.",
    email: "hello@sylo.app",
    phone: "+1 (555) 123-4567",
    location: "Dubai, UAE",
    copyright: "Sylo. All rights reserved.",
  },
  ar: {
    tagline: "نظام تشغيل المطاعم الشامل الذي يدعم أعمال الطعام الحديثة.",
    email: "hello@sylo.app",
    phone: "+1 (555) 123-4567",
    location: "دبي، الإمارات",
    copyright: "Sylo. جميع الحقوق محفوظة.",
  },
};

export default function AltFooter() {
  const { isArabic } = useLanguage();
  
  const footerLinks = isArabic ? footerLinksAr : footerLinksEn;
  const text = isArabic ? textContent.ar : textContent.en;
  const ArrowIcon = isArabic ? ArrowUpLeft : ArrowUpRight;

  return (
    <footer className="relative bg-white dark:bg-zinc-950 border-t border-gray-100 dark:border-zinc-800 transition-colors duration-300" dir={isArabic ? "rtl" : "ltr"}>
      {/* Main footer content */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-12 lg:gap-8">
          {/* Brand Column */}
          <div className="col-span-2">
            <motion.a
              href="#"
              className="inline-flex items-center gap-2 mb-6"
              whileHover={{ scale: 1.02 }}
            >
              <div className="relative w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center">
                <span
                  className="text-white dark:text-black font-bold text-lg"
                  style={{ fontFamily: "Syne, sans-serif" }}
                >
                  S
                </span>
              </div>
              <span
                className="text-xl font-bold text-black dark:text-white"
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                Sylo
              </span>
            </motion.a>
            <p 
              className="text-gray-500 dark:text-zinc-400 mb-8 max-w-xs leading-relaxed"
              style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
            >
              {text.tagline}
            </p>

            {/* Contact Info */}
            <div className="space-y-3 text-sm">
              <a
                href="mailto:hello@sylo.app"
                className="flex items-center gap-3 text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors group"
              >
                <Mail className="w-4 h-4" />
                {text.email}
                <ArrowIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              <div className="flex items-center gap-3 text-gray-500 dark:text-zinc-400">
                <Phone className="w-4 h-4" />
                {text.phone}
              </div>
              <div 
                className="flex items-center gap-3 text-gray-500 dark:text-zinc-400"
                style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
              >
                <MapPin className="w-4 h-4" />
                {text.location}
              </div>
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 
                className="font-semibold text-black dark:text-white mb-4 text-sm tracking-wide"
                style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
              >
                {category}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-sm text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors inline-flex items-center gap-1 group"
                      style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                    >
                      {link.name}
                      <ArrowIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Section */}
      <div className="border-t border-gray-100 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <p 
              className="text-sm text-gray-400 dark:text-zinc-600"
              style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
            >
              © {new Date().getFullYear()} {text.copyright}
            </p>

            {/* Social Links */}
            <div className="flex items-center gap-2">
              {socialLinks.map((social) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  whileHover={{ scale: 1.1, y: -2 }}
                  className="w-10 h-10 rounded-full border border-gray-200 dark:border-zinc-700 flex items-center justify-center text-gray-400 dark:text-zinc-500 hover:text-black dark:hover:text-white hover:border-black dark:hover:border-white transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-4 h-4" />
                </motion.a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Decorative bottom line */}
      <div className="h-1 bg-gradient-to-r from-gray-100 dark:from-zinc-800 via-black dark:via-white to-gray-100 dark:to-zinc-800" />
    </footer>
  );
}
