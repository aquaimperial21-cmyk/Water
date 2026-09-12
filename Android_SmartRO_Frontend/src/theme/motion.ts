// Motion presets — Moti/Reanimated descriptors so screens feel choreographed.
// Each preset returns a plain config object usable as <MotiView from animate transition />.

import { Easing } from 'react-native-reanimated';
import type { MotiTransitionProp } from 'moti';

export const easing = {
  out: Easing.bezier(0.16, 1, 0.3, 1).factory(),
  inOut: Easing.bezier(0.65, 0, 0.35, 1).factory(),
  spring: { type: 'spring' as const, damping: 18, stiffness: 220, mass: 0.9 },
  softSpring: { type: 'spring' as const, damping: 22, stiffness: 160, mass: 0.9 },
};

export const duration = {
  micro: 140,
  short: 220,
  base: 320,
  long: 480,
  hero: 720,
};

// Default screen-content reveal: opacity 0->1, translateY 12->0
export const fadeRise = {
  from: { opacity: 0, translateY: 12 },
  animate: { opacity: 1, translateY: 0 },
  transition: { type: 'timing', duration: duration.base, easing: easing.out } as unknown as MotiTransitionProp,
};

export const fade = {
  from: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { type: 'timing', duration: duration.short, easing: easing.out } as unknown as MotiTransitionProp,
};

export const scaleIn = {
  from: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  transition: { type: 'timing', duration: duration.base, easing: easing.out } as unknown as MotiTransitionProp,
};

export const slideUp = {
  from: { opacity: 0, translateY: 24 },
  animate: { opacity: 1, translateY: 0 },
  transition: easing.spring as unknown as MotiTransitionProp,
};

// Stagger helper — delay = i * step. Cap at maxDelay to avoid trailing waits.
export const stagger = (i: number, step = 60, maxDelay = 600) => ({
  delay: Math.min(i * step, maxDelay),
});

// Loop preset for subtle "liquid pulse" on brand mark / progress ring
export const liquidPulse = {
  from: { scale: 0.985, opacity: 0.92 },
  animate: { scale: 1.015, opacity: 1 },
  transition: {
    type: 'timing',
    duration: 2400,
    loop: true,
    repeatReverse: true,
    easing: easing.inOut,
  } as unknown as MotiTransitionProp,
};

export const motion = {
  easing,
  duration,
  fadeRise,
  fade,
  scaleIn,
  slideUp,
  stagger,
  liquidPulse,
};
