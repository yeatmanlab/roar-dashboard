/**
 * Utility functions for converting Drizzle pgEnums to TypeScript const objects
 */

type DerivedKeys<V extends readonly string[], EnumName extends string | undefined> = Uppercase<
  EnumName extends string ? `${EnumName}_${V[number]}` | V[number] : V[number]
>;

/**
 * Derives an UPPER_SNAKE_CASE key from an enum value
 *
 * @param value - The enum value string
 * @param enumName - Optional enum name to prefix numeric values
 * @returns The derived key in UPPER_SNAKE_CASE
 *
 * @example
 * deriveKey('super_admin') // 'SUPER_ADMIN'
 * deriveKey('oidc.clever') // 'OIDC_CLEVER'
 * deriveKey('PreKindergarten') // 'PRE_KINDERGARTEN'
 * deriveKey('1', 'grade') // 'GRADE_1'
 */
function deriveKey(value: string, enumName?: string): string {
  // Numeric values: prefix with enum name
  if (/^\d+$/.test(value) && enumName) {
    return `${enumName.toUpperCase()}_${value}`;
  }
  return value
    .replace(/\./g, '_') // oidc.clever → oidc_clever
    .replace(/([a-z])([A-Z])/g, '$1_$2') // PreKindergarten → Pre_Kindergarten
    .toUpperCase();
}

/**
 * Converts a Drizzle pgEnum to a const object with UPPER_SNAKE_CASE keys
 *
 * @param pgEnumObj - The Drizzle pgEnum object (must have enumValues property)
 * @param enumName - Optional enum name to prefix numeric values (e.g., 'grade' for GRADE_1)
 * @returns A const object mapping keys to enum values
 *
 * @example
 * // For a simple enum
 * const authProviderEnum = pgEnum('auth_provider', ['password', 'google']);
 * const AuthProvider = pgEnumToConst(authProviderEnum);
 * // Result: { PASSWORD: 'password', GOOGLE: 'google' }
 *
 * @example
 * // For an enum with numeric values
 * const gradeEnum = pgEnum('grade', ['1', '2', 'Kindergarten']);
 * const Grade = pgEnumToConst(gradeEnum, 'grade');
 * // Result: { GRADE_1: '1', GRADE_2: '2', KINDERGARTEN: 'Kindergarten' }
 */
export function pgEnumToConst<const V extends readonly string[], EnumName extends string | undefined = undefined>(
  pgEnumObj: { enumValues: V },
  enumName?: EnumName,
) {
  return Object.fromEntries(pgEnumObj.enumValues.map((v) => [deriveKey(v, enumName), v])) as Record<
    DerivedKeys<V, EnumName>,
    V[number]
  >;
}
