# Testing GET /v1/groups/:groupId/invitation-code

## Test Data Created

A valid invitation code was created for testing:

- Group ID: `f8ab89ed-f81e-5508-a744-55d44463c980` (Cypress Test Group)
- Code: `test-code-2026`
- Valid from: 2026-02-10
- Valid to: 2026-03-13

## Manual Testing Steps

### 1. Test Authentication Required (401)

```bash
curl -k "https://localhost:4000/v1/groups/f8ab89ed-f81e-5508-a744-55d44463c980/invitation-code"
```

**Expected Response:**

```json
{
  "error": {
    "message": "Token missing.",
    "code": "auth/required"
  }
}
```

✅ **Result:** PASS - Returns 401 with correct error code

### 2. Test Super Admin Access (200)

```bash
curl -k -H "Authorization: Bearer <VALID_SUPER_ADMIN_TOKEN>" \
  "https://localhost:4000/v1/groups/f8ab89ed-f81e-5508-a744-55d44463c980/invitation-code"
```

**Expected Response:**

```json
{
  "data": {
    "id": "cfb8c967-36cf-409e-b503-a6403f5c7449",
    "groupId": "f8ab89ed-f81e-5508-a744-55d44463c980",
    "code": "test-code-2026",
    "validFrom": "2026-02-10T22:16:45.051Z",
    "validTo": "2026-03-13T21:16:45.051Z",
    "dates": {
      "created": "2026-02-11T22:16:45.051Z",
      "updated": "2026-02-11T22:16:45.051Z"
    }
  }
}
```

**Note:** Requires a fresh Firebase token. Previous token expired.

### 3. Test Non-Super Admin Access (403)

```bash
curl -k -H "Authorization: Bearer <VALID_NON_SUPER_ADMIN_TOKEN>" \
  "https://localhost:4000/v1/groups/f8ab89ed-f81e-5508-a744-55d44463c980/invitation-code"
```

**Expected Response:**

```json
{
  "error": {
    "message": "Access denied",
    "code": "auth/forbidden"
  }
}
```

### 4. Test No Valid Invitation Code (404)

```bash
curl -k -H "Authorization: Bearer <VALID_SUPER_ADMIN_TOKEN>" \
  "https://localhost:4000/v1/groups/91021ef3-b1e9-544e-8dc7-41a0bd8db821/invitation-code"
```

**Expected Response:**

```json
{
  "error": {
    "message": "No valid invitation code found",
    "code": "resource/not-found"
  }
}
```

## Implementation Summary

### Files Created:

1. **API Contract:**
   - `packages/api-contract/src/v1/groups/schema.ts` - Invitation code schema
   - `packages/api-contract/src/v1/groups/contract.ts` - Endpoint contract
   - `packages/api-contract/src/v1/groups/index.ts` - Exports

2. **Backend:**
   - `apps/backend/src/repositories/invitation-code.repository.ts` - Database queries
   - `apps/backend/src/services/invitation-code/invitation-code.service.ts` - Business logic
   - `apps/backend/src/controllers/groups.controller.ts` - HTTP handling
   - `apps/backend/src/routes/groups.ts` - Route registration

### Files Modified:

1. `apps/backend/src/constants/permissions.ts` - Added Groups.InvitationCodes.READ
2. `packages/api-contract/src/v1/index.ts` - Added GroupsContract
3. `apps/backend/src/routes/index.ts` - Registered groups routes

### Key Features:

- ✅ Authentication required via AuthGuardMiddleware
- ✅ Authorization: Super admins only
- ✅ Returns latest valid invitation code (by created_at DESC)
- ✅ Filters by valid_from <= NOW() AND (valid_to >= NOW() OR valid_to IS NULL)
- ✅ Returns 403 for non-super admins
- ✅ Returns 404 when no valid code exists
- ✅ Proper error handling with ApiError
- ✅ Logging for security events

## Next Steps:

1. Get a fresh Firebase token for full manual testing
2. Write automated tests (unit + integration)
3. Test with Postman/Insomnia collection
4. Update API documentation
