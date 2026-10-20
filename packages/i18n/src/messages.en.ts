/**
 * English message catalogue. Every user-facing string lives in a catalogue so
 * Hindi and regional languages can be added without touching components.
 */
export const en = {
  'app.title': 'Margwise',
  'studio.title': 'Margwise Studio',
  'app.shell.notice': 'Foundations build. Nothing leaves this device.',
} as const;

export type MessageKey = keyof typeof en;
