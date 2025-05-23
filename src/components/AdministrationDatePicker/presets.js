export const datePresets = Object.freeze({
  summer: {
    // June 1st to August 31st
    label: 'Summer',
    start: new Date(new Date().getFullYear(), 5, 1),
    end: new Date(new Date().getFullYear(), 8, 31),
  },
  fall: {
    // September 1st to December 31st
    label: 'Fall',
    start: new Date(new Date().getFullYear(), 8, 1),
    end: new Date(new Date().getFullYear(), 11, 31),
  },
  winter: {
    // December 1st to February 28th
    label: 'Winter',
    start: new Date(new Date().getFullYear(), 11, 1),
    end: new Date(new Date().getFullYear() + 1, 2, 28),
  },
  spring: {
    // March 1st to May 31st
    label: 'Spring',
    start: new Date(new Date().getFullYear() + 1, 2, 29),
    end: new Date(new Date().getFullYear() + 1, 5, 31),
  },
});
