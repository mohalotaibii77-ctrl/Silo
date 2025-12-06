"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useLanguage } from "@/lib/language-context"

export function ModeToggle() {
  const { theme, setTheme: setNextTheme } = useTheme()
  const { setTheme: syncThemeToDB } = useLanguage()

  const handleThemeToggle = () => {
    const newTheme = theme === "dark" ? "light" : "dark"
    setNextTheme(newTheme)
    // Sync theme preference to database
    syncThemeToDB(newTheme as 'light' | 'dark' | 'system')
  }

  return (
    <button
      onClick={handleThemeToggle}
      className="p-2 rounded-md hover:bg-secondary transition-colors relative"
      aria-label="Toggle theme"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-orange-500" />
      <Moon className="absolute top-2 left-2 h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-zinc-400" />
    </button>
  )
}

