"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Home,
  LineChart,
  LayoutDashboard,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Home", icon: Home, href: "/" },
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Agents", icon: Users, href: "/register" },
  { label: "Analytics", icon: LineChart, href: "/analytics" },
];

const MOBILE_LABEL_WIDTH = 72;

export function BottomNavBar({
  className,
  items = navItems,
  defaultIndex = 0,
  stickyBottom = true, // Defaulted to true for typical bottom nav behavior
}) {
  const [activeIndex, setActiveIndex] = useState(defaultIndex);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  return (
    <motion.nav
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={cn(
        "bg-card border border-border rounded-full flex items-center p-2 shadow-xl min-w-[320px] max-w-[95vw] h-[58px]",
        stickyBottom && "fixed inset-x-0 bottom-4 mx-auto z-20 w-fit",
        className
      )}
    >
      {items.map((item, idx) => {
        const Icon = item.icon;
        const isActive = activeIndex === idx;
        const isHovered = hoveredIndex === idx;

        return (
          <Link
            key={`${item.label}-${idx}`}
            href={item.href || "#"}
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
            className={cn(
              "relative flex items-center px-4 py-2 rounded-full transition-colors duration-300 focus:outline-none",
              isActive ? "text-primary dark:text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {/* Sliding Active Background */}
            {isActive && (
              <motion.div
                layoutId="activeBackground"
                className="absolute inset-0 bg-primary/10 dark:bg-primary/20 rounded-full"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}

            {/* Hover Background */}
            <AnimatePresence>
              {isHovered && !isActive && (
                <motion.div
                  layoutId="hoverBackground"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-0 bg-muted/50 rounded-full -z-10"
                />
              )}
            </AnimatePresence>

            <div className="relative z-10 flex items-center">
              <Icon
                size={20}
                strokeWidth={isActive ? 2.5 : 2}
                className="transition-transform duration-200"
              />

              <motion.div
                initial={false}
                animate={{
                  width: isActive ? "auto" : 0,
                  opacity: isActive ? 1 : 0,
                  marginLeft: isActive ? 8 : 0,
                }}
                className="overflow-hidden whitespace-nowrap"
              >
                <span className="font-semibold text-sm">
                  {item.label}
                </span>
              </motion.div>
            </div>
          </Link>
        );
      })}
    </motion.nav>
  );
}

export default BottomNavBar;