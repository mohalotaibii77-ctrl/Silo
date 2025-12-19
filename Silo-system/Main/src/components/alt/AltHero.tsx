"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { ArrowUpRight, Circle } from "lucide-react";

const words = ["Smarter", "Faster", "Better", "On Auto-pilot"];

export default function AltHero() {
  const [wordIndex, setWordIndex] = useState(0);

  // Word rotation effect
  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % words.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      className="relative min-h-screen bg-white dark:bg-zinc-950 overflow-hidden transition-colors duration-300"
    >
      {/* Main content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pt-40 pb-32">
        <div className="grid lg:grid-cols-12 gap-12 items-start">
          {/* Left column - Main headline */}
          <div className="lg:col-span-8">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.25, 0.1, 0, 1] }}
            >
              {/* Eyebrow */}
              <div className="flex items-center gap-3 mb-8">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-2 h-2 bg-black dark:bg-white rounded-full"
                />
                <span className="text-sm font-medium tracking-[0.2em] uppercase text-gray-500 dark:text-zinc-500">
                  Restaurant Operating System
                </span>
              </div>

              {/* Main headline with staggered animation */}
              <h1
                className="text-[clamp(3rem,8vw,7rem)] font-bold leading-[0.9] tracking-tight text-black dark:text-white mb-8"
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                <motion.span
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="block"
                >
                  Run
                </motion.span>
                <motion.span
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="block text-gray-300 dark:text-zinc-700"
                >
                  Operations
                </motion.span>
                <motion.span
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.6 }}
                  className="block relative inline-flex items-center"
                >
                  <span className="relative inline-block overflow-hidden h-[1.15em] align-bottom min-w-[10ch]">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={wordIndex}
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: "0%", opacity: 1 }}
                        exit={{ y: "-100%", opacity: 0 }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className="block"
                      >
                        {words[wordIndex]}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                </motion.span>
              </h1>
            </motion.div>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="text-xl text-gray-500 dark:text-zinc-400 max-w-xl leading-relaxed mb-12"
            >
              Unify POS, inventory, HR, accounting, and operations in one 
              intelligent platform. Make data-driven decisions with AI-powered 
              insights.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1 }}
              className="flex flex-wrap items-center gap-4"
            >
              <motion.a
                href="#contact"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group relative inline-flex items-center gap-2 px-8 py-4 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-full overflow-hidden"
              >
                <span className="relative z-10">Start Free Trial</span>
                <ArrowUpRight className="w-5 h-5 relative z-10 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                <motion.div
                  className="absolute inset-0 bg-gray-800 dark:bg-zinc-200"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: 0 }}
                  transition={{ duration: 0.3 }}
                />
              </motion.a>
              <motion.a
                href="#demo"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group inline-flex items-center gap-2 px-8 py-4 border-2 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-zinc-100 font-semibold rounded-full hover:border-gray-900 dark:hover:border-zinc-300 transition-colors"
              >
                Watch Demo
                <Circle className="w-3 h-3 fill-current group-hover:animate-pulse" />
              </motion.a>
            </motion.div>
          </div>

          {/* Right column - Logo */}
          <div className="lg:col-span-4 lg:pt-32 hidden lg:flex items-start justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 1, type: "spring" }}
              className="relative"
            >
              {/* Command icon / Logo */}
              <motion.svg
                width="250"
                height="250"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-black dark:text-white"
              >
                <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
              </motion.svg>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Bottom scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-xs tracking-[0.2em] uppercase text-gray-400 dark:text-zinc-600">
          Scroll
        </span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-px h-12 bg-gradient-to-b from-gray-400 dark:from-zinc-600 to-transparent"
        />
      </motion.div>
    </section>
  );
}
