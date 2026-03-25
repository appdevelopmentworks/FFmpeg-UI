import type { Variants } from 'framer-motion';

// ── Transitions ──────────────────────────────────────────────────────────────

export const TRANSITIONS = {
  fast:       { duration: 0.15, ease: [0.4, 0, 0.2, 1] as const },
  normal:     { duration: 0.2,  ease: [0.4, 0, 0.2, 1] as const },
  slow:       { duration: 0.3,  ease: [0.4, 0, 0.2, 1] as const },
  decelerate: { duration: 0.2,  ease: [0, 0, 0.2, 1]   as const },
  accelerate: { duration: 0.2,  ease: [0.4, 0, 1, 1]   as const },
  spring:     { type: 'spring' as const, stiffness: 300, damping: 25 },
  tabSpring:  { type: 'spring' as const, stiffness: 500, damping: 35 },
};

// ── Variant Presets ───────────────────────────────────────────────────────────

export const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: TRANSITIONS.normal },
  exit:    { opacity: 0, transition: TRANSITIONS.fast },
};

export const slideUp: Variants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: TRANSITIONS.normal },
  exit:    { opacity: 0, y: -4, transition: TRANSITIONS.fast },
};

export const slideDown: Variants = {
  hidden:  { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, transition: TRANSITIONS.normal },
  exit:    { opacity: 0, y: 8, transition: TRANSITIONS.fast },
};

/** Used for main tab content panels */
export const tabSwitch: Variants = {
  hidden:  { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: TRANSITIONS.normal },
  exit:    { opacity: 0, y: -4, transition: TRANSITIONS.fast },
};

/** Modal backdrop */
export const backdropVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: TRANSITIONS.normal },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
};

/** Modal content panel */
export const modalVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.95, y: 8 },
  visible: { opacity: 1, scale: 1,    y: 0, transition: TRANSITIONS.slow },
  exit:    { opacity: 0, scale: 0.97, y: 4, transition: TRANSITIONS.fast },
};

/** Dropdown / popover */
export const popoverVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.96, y: -4 },
  visible: { opacity: 1, scale: 1,    y: 0,  transition: TRANSITIONS.fast },
  exit:    { opacity: 0, scale: 0.96, y: -4, transition: TRANSITIONS.fast },
};

/** Pulsing glow for active progress */
export const progressPulse: Variants = {
  animate: {
    opacity: [1, 0.65, 1],
    transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
  },
};

/** Staggered list children */
export const staggerContainer: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.05 } },
};

export const staggerItem: Variants = {
  hidden:  { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: TRANSITIONS.normal },
};

// ── Gesture helpers (pass directly to motion props) ──────────────────────────

export const tapScale   = { whileTap:   { scale: 0.94 } };
export const hoverScale = { whileHover: { scale: 1.02 } };
