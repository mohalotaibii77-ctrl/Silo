"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, EyeOff, Loader2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://silo-backend.onrender.com";

export default function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const { isArabic } = useLanguage();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const text = {
    title: isArabic ? "تسجيل الدخول" : "Sign In",
    subtitle: isArabic 
      ? "أدخل بيانات الاعتماد الخاصة بك للوصول إلى حسابك" 
      : "Enter your credentials to access your account",
    identifier: isArabic ? "البريد الإلكتروني أو اسم المستخدم" : "Email or Username",
    password: isArabic ? "كلمة المرور" : "Password",
    signIn: isArabic ? "تسجيل الدخول" : "Sign In",
    signingIn: isArabic ? "جاري تسجيل الدخول..." : "Signing in...",
    forgotPassword: isArabic ? "نسيت كلمة المرور؟" : "Forgot password?",
    noAccount: isArabic ? "ليس لديك حساب؟" : "Don't have an account?",
    getStarted: isArabic ? "ابدأ الآن" : "Get Started",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/unified-auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || (isArabic ? "فشل تسجيل الدخول" : "Login failed"));
        setIsLoading(false);
        return;
      }

      // Build redirect URL with token as query parameter
      // The target app will read this and auto-authenticate
      const redirectUrl = new URL(data.redirectUrl);
      redirectUrl.searchParams.set("token", data.token);
      redirectUrl.searchParams.set("user", encodeURIComponent(JSON.stringify(data.user)));
      
      if (data.business) {
        redirectUrl.searchParams.set("business", encodeURIComponent(JSON.stringify(data.business)));
      }

      // Redirect to the appropriate app with auth data
      window.location.href = redirectUrl.toString();
    } catch (err) {
      console.error("Login error:", err);
      setError(isArabic ? "حدث خطأ. حاول مرة أخرى." : "An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              dir={isArabic ? "rtl" : "ltr"}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="px-8 pt-8 pb-4">
                <h2
                  className="text-2xl font-bold text-gray-900"
                  style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "Syne, sans-serif" }}
                >
                  {text.title}
                </h2>
                <p
                  className="mt-2 text-sm text-gray-500"
                  style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                >
                  {text.subtitle}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="px-8 pb-8">
                {/* Error message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm"
                    style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                  >
                    {error}
                  </motion.div>
                )}

                {/* Identifier field */}
                <div className="mb-4">
                  <label
                    htmlFor="identifier"
                    className="block text-sm font-medium text-gray-700 mb-2"
                    style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                  >
                    {text.identifier}
                  </label>
                  <input
                    type="text"
                    id="identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all"
                    placeholder={isArabic ? "أدخل البريد أو اسم المستخدم" : "Enter email or username"}
                    required
                    disabled={isLoading}
                    style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                  />
                </div>

                {/* Password field */}
                <div className="mb-6">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700 mb-2"
                    style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                  >
                    {text.password}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all pr-12"
                      placeholder={isArabic ? "أدخل كلمة المرور" : "Enter password"}
                      required
                      disabled={isLoading}
                      style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Forgot password link */}
                <div className="mb-6 text-right">
                  <a
                    href="#"
                    className="text-sm text-gray-500 hover:text-black transition-colors"
                    style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                  >
                    {text.forgotPassword}
                  </a>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 bg-black text-white font-semibold rounded-xl hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {text.signingIn}
                    </>
                  ) : (
                    text.signIn
                  )}
                </button>

                {/* Sign up link */}
                <p
                  className="mt-6 text-center text-sm text-gray-500"
                  style={{ fontFamily: isArabic ? "IBM Plex Sans Arabic, sans-serif" : "inherit" }}
                >
                  {text.noAccount}{" "}
                  <a href="#contact" onClick={onClose} className="text-black font-medium hover:underline">
                    {text.getStarted}
                  </a>
                </p>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

