/**
 * Dispatch table mapping the (plural) org type used throughout the dashboard to
 * the typed ts-rest `listUsers` action and its path-param name.
 *
 * The plural keys (`districts`, `schools`, `classes`, `groups`) are exactly the
 * values the per-org `listUsers` route receives as `:orgType` — they originate
 * from `activeOrgType` in `OrgsList.vue`, which is a plural `ORG_TYPES` value.
 * Each org type has its own endpoint (`GET /v1/{type}/:id/users`) with a
 * distinct path-param name, so the resolver returns the correct action plus the
 * param key to populate.
 *
 * Correctness/security note: dispatching to the wrong entry would query a
 * different org type (e.g. asking the schools endpoint for a district id), so
 * this map is the single point that pins org type → endpoint. It is shared by
 * every consumer that reads the org enrolled-user list (the table query and the
 * CSV export) precisely so the two can never drift to different mappings.
 * `families` is intentionally absent — there is no per-family user-list endpoint,
 * so callers must guard against it before dispatching here.
 *
 * @param {ReturnType<typeof import('@/clients/roar-api').getRoarApiClient>} client – The typed ts-rest client.
 * @returns {Record<string, { action: Function, paramKey: string }>} Resolver map.
 */
export const orgUsersResolvers = (client) => ({
  districts: { action: client.districts.listUsers, paramKey: 'districtId' },
  schools: { action: client.schools.listUsers, paramKey: 'schoolId' },
  classes: { action: client.classes.listUsers, paramKey: 'classId' },
  groups: { action: client.groups.listUsers, paramKey: 'groupId' },
});

export default orgUsersResolvers;
