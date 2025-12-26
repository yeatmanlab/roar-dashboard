/**
 * Grade Enum
 *
 * Enumerates the available grade levels.
 * Manually defined to preserve existing key names (FIRST, SECOND, etc.)
 */
import { gradeEnum } from '../db/schema/enums';

const Grade = {
  FIRST: '1',
  SECOND: '2',
  THIRD: '3',
  FOURTH: '4',
  FIFTH: '5',
  SIXTH: '6',
  SEVENTH: '7',
  EIGHTH: '8',
  NINTH: '9',
  TENTH: '10',
  ELEVENTH: '11',
  TWELFTH: '12',
  THIRTEENTH: '13',
  PREKINDERGARTEN: 'PreKindergarten',
  TRANSITIONALKINDERGARTEN: 'TransitionalKindergarten',
  KINDERGARTEN: 'Kindergarten',
  INFANTTODDLER: 'InfantToddler',
  PRESCHOOL: 'Preschool',
  POSTGRADUATE: 'PostGraduate',
  UNGRADED: 'Ungraded',
  OTHER: 'Other',
} as const satisfies Record<string, (typeof gradeEnum.enumValues)[number]>;

export type Grade = (typeof gradeEnum.enumValues)[number];
export default Grade;
