export const PA_TRIAL_TYPES = {
  FSM: 'FSM',
  LSM: 'LSM',
  DEL: 'DEL',
} as const;

export type PaTrialType = (typeof PA_TRIAL_TYPES)[keyof typeof PA_TRIAL_TYPES];

export const PA_CATS = [
  'practiceFSM',
  'practiceLSM',
  'practiceDEL',
  'fsm',
  'lsm',
  'del',
  'composite',
  'composite_foundational',
] as const;

export type PaCat = (typeof PA_CATS)[number];
