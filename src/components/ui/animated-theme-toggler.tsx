"use client"

import React, { useCallback, useEffect, useState } from "react"
import type { ComponentPropsWithoutRef } from "react"
import { Moon, Sun } from "lucide-react"
import { flushSync } from "react-dom"
import { cn } from "@/src/lib/utils"

interface AnimatedThemeTogglerProps extends ComponentPropsWithoutRef<"button"> {
  className?: string
}

export const AnimatedThemeToggler = ({
  className,
  ...props
}: AnimatedThemeTogglerProps) => {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"))
    }

    updateTheme()

    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [])

  const toggleTheme = useCallback((event: React.MouseEvent) => {
    const applyTheme = () => {
      const newTheme = !isDark
      setIsDark(newTheme)
      document.documentElement.classList.toggle("dark")
      localStorage.setItem("theme", newTheme ? "dark" : "light")
    }

    if (typeof document.startViewTransition !== "function") {
      applyTheme()
      return
    }

    const x = event.clientX
    const y = event.clientY
    const endRadius = Math.hypot(
      Math.max(x, innerWidth - x),
      Math.max(y, innerHeight - y)
    )

    const transition = document.startViewTransition(() => {
      flushSync(applyTheme)
    })

    transition.ready.then(() => {
      const x = event.clientX
      const y = event.clientY
      const endRadius = Math.hypot(
        Math.max(x, innerWidth - x),
        Math.max(y, innerHeight - y)
      )

      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 700,
          easing: "cubic-bezier(0.19, 1, 0.22, 1)",
          pseudoElement: "::view-transition-new(root)",
        }
      )
    })
  }, [isDark])

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "relative p-2 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-all outline-hidden active:scale-95 bg-white dark:bg-[#0A0A0B] shadow-sm",
        className
      )}
      {...props}
    >
      <div className="relative w-4 h-4 overflow-hidden">
        <Sun className={cn(
          "w-4 h-4 absolute inset-0 transition-transform duration-500",
          isDark ? "translate-y-0" : "-translate-y-8"
        )} />
        <Moon className={cn(
          "w-4 h-4 absolute inset-0 transition-transform duration-500",
          isDark ? "translate-y-8" : "translate-y-0"
        )} />
      </div>
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
