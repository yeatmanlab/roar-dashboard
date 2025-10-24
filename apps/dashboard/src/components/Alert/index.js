import { cva } from 'class-variance-authority';

export { default as Alert } from './Alert.vue';
export { default as AlertTitle } from './AlertTitle.vue';
export { default as AlertDescription } from './AlertDescription.vue';

export const ALERT_VARIANTS = Object.freeze({
  DEFAULT: 'default',
  DESTRUCTIVE: 'destructive',
});

export const alertVariants = cva(
  'relative w-full rounded border border-solid border-gray-300 p-3 [&>svg]:text-gray-950 flex text-left',
  {
    variants: {
      variant: {
        [ALERT_VARIANTS.DEFAULT]: 'text-gray-800',
        [ALERT_VARIANTS.DESTRUCTIVE]: 'bg-red-50 border-red-500/50 text-red-500 [&>svg]:text-red-500',
      },
    },
    defaultVariants: {
      variant: [ALERT_VARIANTS.DEFAULT],
    },
  },
);
