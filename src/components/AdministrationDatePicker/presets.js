export const datePresets = Object.freeze({
  summer: {
    // June 16th to July 31st
    label: 'Summer',
    start: new Date(new Date().getFullYear(), 5, 16),
    end: new Date(new Date().getFullYear(), 6, 31),
  },
  fall: {
    // August 1st to November 30th
    label: 'Fall',
    start: new Date(new Date().getFullYear(), 7, 1),
    end: new Date(new Date().getFullYear(), 11, 30),
  },
  winter: {
    // December 1st to March 31st
    label: 'Winter',
    start: new Date(new Date().getFullYear(), 11, 1),
    end: new Date(new Date().getFullYear() + 1, 2, 31),
  },
  spring: {
    // April 1st to June 15th
    label: 'Spring',
    start: new Date(new Date().getFullYear() + 1, 3, 1),
    end: new Date(new Date().getFullYear() + 1, 5, 15),
  },
});
