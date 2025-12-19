import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/lib/language-context";
// import { IdleTimeoutProvider } from "@/lib/idle-timeout"; // TODO: Re-enable idle timeout later
import { ConfigProvider } from "@/lib/config-context";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Silo Store Setup",
  description: "Restaurant onboarding and setup wizard for Silo POS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${notoArabic.variable} antialiased bg-background text-foreground font-sans`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LanguageProvider>
            <ConfigProvider>
              {/* TODO: Re-enable idle timeout later */}
              {/* <IdleTimeoutProvider> */}
                {children}
              {/* </IdleTimeoutProvider> */}
            </ConfigProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

