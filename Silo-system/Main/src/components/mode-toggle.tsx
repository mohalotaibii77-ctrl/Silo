"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
        <Sun className="h-5 w-5 text-gray-600" />
      </button>
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`p-2 rounded-full transition-colors ${
        isDark ? "hover:bg-zinc-800" : "hover:bg-gray-100"
      }`}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Moon className="h-5 w-5 text-zinc-300" />
      ) : (
        <Sun className="h-5 w-5 text-amber-500" />
      )}
    </button>
  )
}
