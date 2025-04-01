export const ORG_TYPES = Object.freeze({
  DISTRICTS: 'districts',
  SCHOOLS: 'schools',
  CLASSES: 'classes',
  GROUPS: 'groups',
  FAMILIES: 'families',
} as const);

export type OrgType = typeof ORG_TYPES[keyof typeof ORG_TYPES];

export const SINGULAR_ORG_TYPES = Object.freeze({
  DISTRICTS: 'district',
  SCHOOLS: 'school',
  CLASSES: 'class',
  GROUPS: 'group',
  FAMILIES: 'family',
} as const);

export type SingularOrgType = typeof SINGULAR_ORG_TYPES[keyof typeof SINGULAR_ORG_TYPES]; 