import { cva } from 'class-variance-authority';

export { default as Alert } from './Alert.vue';
export { default as AlertTitle } from './AlertTitle.vue';
export { default as AlertDescription } from './AlertDescription.vue';

export const ALERT_VARIANTS = Object.freeze({
  DEFAULT: 'default',
  DESTRUCTIVE: 'destructive',
});

export const alertVariants = cva(
  'relative w-full rounded border border-zinc-200 p-3 [&>svg]:text-zinc-950 dark:border-zinc-800 dark:[&>svg]:text-zinc-50 flex text-left',
  {
    variants: {
      variant: {
        [ALERT_VARIANTS.DEFAULT]: 'text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50',
        [ALERT_VARIANTS.DESTRUCTIVE]:
          'bg-red-50 border-red-500/50 text-red-500 dark:border-red-500 [&>svg]:text-red-500 dark:border-red-900/50 dark:text-red-900 dark:dark:border-red-900 dark:[&>svg]:text-red-900',
      },
    },
    defaultVariants: {
      variant: [ALERT_VARIANTS.DEFAULT],
    },
  },
);
