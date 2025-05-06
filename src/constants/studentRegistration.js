export const REGISTRATION_STEPS = Object.freeze({
  UPLOAD: '1',
  REQUIRED: '2',
  NAMES: '3',
  DEMOGRAPHICS: '4',
  OTHER: '5',
  ORGANIZATIONS: '6',
  PREVIEW: '7',
});

export const FIELD_TYPES = Object.freeze({
  REQUIRED: 'required',
  NAMES: 'names',
  DEMOGRAPHICS: 'demographics',
  OPTIONAL: 'optional',
  ORGANIZATIONS: 'organizations',
});

export const SUBMIT_STATUS = Object.freeze({
  IDLE: 'idle',
  TRANSFORMING: 'transforming',
  SUBMITTING: 'submitting',
  COMPLETE: 'complete',
});

export const HEADER_OVERRIDES = Object.freeze({
  dob: 'Date of Birth',
  first: 'First Name',
  middle: 'Middle Name',
  last: 'Last Name',
  ellStatus: 'English Language Learner Status',
  frlStatus: 'Free and Reduced Lunch Status',
  iepStatus: 'IEP Status',
  pid: 'PID',
});
