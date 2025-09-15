/**
 * Org Type Enum
 *
 * Enumerates the available org types following the OneRoster spec v1.1
 * @see {@link https://www.imsglobal.org/oneroster-v11-final-specification#_Toc480452024}
 */
enum OrgType {
  NATIONAL = 'national',
  STATE = 'state',
  LOCAL = 'local',
  DISTRICT = 'district',
  SCHOOL = 'school',
  DEPARTMENT = 'department',
}

export default OrgType;
