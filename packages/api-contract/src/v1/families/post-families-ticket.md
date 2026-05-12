## Summary

Creates a new family entity in the database and registers at least one new parent to associate with that family.

This endpoint does not handle adding children (or additional parents) to the family after the family has been created.

## Context

We use `createNewFamily` Google Cloud Function with an `onCall` trigger which takes a `request` parameter. The `request` parameter is deconstructed into the necessary fields
which are passed into the function handler `createFamily`.

```ts
const caretakerEmail = request.data.caretakerEmail;
const caretakerPassword = request.data.caretakerPassword;
const caretakerUserData = request.data.caretakerUserData;
const children = request.data.children;
const consentData = request.data.consentData;
const isTestData = request.data.isTestData ?? false;

return await createFamily(caretakerEmail, caretakerPassword, caretakerUserData, children, consentData, isTestData);
```

### Firebase Implementation

The `createFamily` handler gets the two Firebase projects (`admin` and `assessment`) and checks for the existence of the family using the `caretakerEmail` argument of the `users` collection.
If a duplicate is found, it takes the first one returned.

Two paths:

- Family exists --> Get familyId from the user's orgs or throw if not found
- Family does not exist --> Create new family

Auth is upserted using `upsertCaregiverAuth` to either get or create user auth in `admin` and `assessment` projects.
In either case, the `assessment` auth user is updated with the new providerId:

```ts
const adminProviderId =
  // @ts-expect-error – Property '_projectId' does not exist on type 'Firestore' (TS2339)
  db.assessment?.projectId === ASSESSMENT_DEV_PROJECT_ID ? `oidc.${ADMIN_DEV_PROJECT_ID}` : `oidc.${ADMIN_PROJECT_ID}`;

await auth.assessment.updateUser(assessmentUid, {
  providerToLink: {
    providerId: adminProviderId,
    uid: adminUid,
    displayName,
    email: caretakerEmail,
  },
}).catch(...);
```

From here, the function calls `addChildrenToFamilyAndSync`, which handles adding any children to the family using information provided in the frontend family creation form.

### Postgres Implementation

The Postgres architecture will still require that a family and a parent be registered concurrently.

The implementation will differ in these ways:

- No need for an activation code on signup
- No need to handle assessment auth checking or linking
- New parents must have a unique email; this prevents externally rostered users from using their provider email to create a family
- A database migration on `families` table will add a `created_by` column referencing the `users` table (UUID) with a uniqueness constraint (parents may join many families, but may only create one)
- Enforce a max family size of 12 (exact number tbd)
- Parents will be assigned `userType = caregiver` with `role = parent` and `auth_provider = password`
- Create entity in `rostering_provider_ids` where `provider_type = dashboard`, `provider_id = userId`, `partner_id = familyId`, `entity_type = user`, `entity_id = userId`
- Create child functionality is captured in the next PR in the chain described in issue [#1751](https://github.com/yeatmanlab/roar-project-management/issues/1751)

Firebase auth account will be created first, since deletion is simple.
New entries will be created in `families`, `users`, and `user_families` within a single Postgres transaction to ensure atomicity.

**Transaction Flow:**

1. Create Firebase auth account (or throw if already in use or generic error occurs)
   - If failed, terminate and do not proceed to transaction
2. Begin Postgres transaction
3. Create `user` entity and return `userId`
4. Create `family` entity and return `familyId`, checking `created_by` uniqueness constraint against `userId`
5. Create `user_family` with foreign key (`userId`, `familyId`)
6. Create `rostering_provider_id` entity using `userId`, and `familyId`
7. Commit transaction - If any step within the transaction fails, all changes are automatically rolled back
   - Then delete Firebase auth account and terminate

## Endpoint

- **Method**: `POST`
- **Route**: `/v1/families`

## Authentication

This is a public facing endpoint, and registration is not constrained to authorized users or by any specific permission.

Uniqueness guards:

- Email is unique
- Email is not associated with a `families.created_by` row

## Authorization

Input email cannot already be in use.
Input email is not already associated with a family.

## Request Specifications

### Request Body

```ts
{
  caretakerData: {
    email: string;
    password: string;
    name: {
      first: string;
      middle?: string;
      last: string;
    }
  },
  familyData?: {
    location?: {
     address1?: string;
     address2?: string;
     city?: string;
     state?: string;
     zip?: string;
     country?: string;
     coordinates?: {
       lat: number;
       lng: number;
     };
    }
  }
}
```

### Required Fields

- `caretakerData.email`: The email address of the caretaker (will be assigned as `families.created_by`).
- `caretakerData.password`: The password of the caretaker.
- `caretakerData.name.first`: The first name of the caretaker.
- `caretakerData.name.last`: The last name of the caretaker.

### Optional Fields

- `caretakerData.name.middle`: The middle name of the caretaker.
- `familyData`: The family data (all optional)

### Sorting

N/A

### Filtering

N/A

## Response Specification

### Success Response

**Status:** `201 Created`
**Body type:** `ApiResponse<{id: string}>`

### Contract

```ts
{
  data: {
    // Family ID of the newly created family
    id: string;
  }
}
```

### Error Response

| Status Code | Reason                                          |
| ----------- | ----------------------------------------------- |
| 400         | The request body is invalid.                    |
| 409         | The email address is already in use.            |
| 422         | The email address has already created a family. |
| 500         | Internal server error.                          |

## Data Source

### Firebase Auth

Validates the user's credentials using Firebase Auth.

### Tables

- `families`: Stores family information, including the `created_by` column referencing the `users` table.
- `users`: Stores user information, including the `id` column used as the foreign key in the `families` table.
- `user_families`: Stores the relationship between users and families, including the `user_id` and `family_id` columns.
- `rostering_provider_ids`: Tracks provider IDs for entities, with `entity_id` as the primary key.

## Rules and Validation

## Rules and Validation

### User Validation

- **Email**
  - Must be a valid email address format.
  - Must be unique across the system (case-insensitive).
  - Max length: 255 characters.
  - Must not already exist in `users` table.
- **Password**
  - Minimum length: 8 characters.
  - Must contain at least one uppercase letter, one lowercase letter, one number, and one special character.
- **Name Fields**
  - `first` and `last` are required; `middle` is optional.
  - Max length: 100 characters each.
  - Must not be empty or whitespace-only after trimming.
  - Allowed characters: letters, hyphens, apostrophes, spaces.

### Family Validation

- **Created By Constraint**
  - `families.created_by` must not already exist for the caretaker's UUID (one family per creator).
  - This ensures a user can only create one family.
- **Family Size**
  - Max 12 members per family.
- **Location (if provided)**
  - **State Code**: Valid ISO 3166-2 format (if provided).
  - **Country Code**: Valid ISO 3166-1 alpha-2 format (if provided).
  - **Coordinates**: If either `lat` or `lng` is provided, both must be provided.
    - Latitude: valid range [-90, 90].
    - Longitude: valid range [-180, 180].
  - **Address Fields**: All address fields are optional; no required interdependencies.

### Rostering Provider IDs

- A `rostering_provider_ids` entry is created with:
  - `provider_type = "dashboard"`
  - `provider_id = userId` (the newly created user's UUID)
  - `partner_id = familyId` (the newly created family's UUID)
  - `entity_type = "user"`
  - `entity_id = userId` (the newly created user's UUID, serves as primary key)

## Acceptance Criteria

### Happy Path

- [ ] Creates a Firebase Auth user.
- [ ] Validates the user's email address.
- [ ] Creates a user in the `users` table.
- [ ] Creates a family in the `families` table.
- [ ] Creates a record in the `user_families` table with foreign key references to the `users` and `families` tables.
- [ ] Creates a record in the `rostering_provider_ids` table
- [ ] The `families.created_by` field is set to the requesting user's UUID.
- [ ] The family ID is returned in the response.
- [ ] Returns 201 if the family is created successfully.

### Error Handling & Atomicity

- [ ] If Firebase Auth creation fails, the Postgres transaction is not started.
- [ ] If any Postgres transaction step fails, all changes are rolled back (no user/family/relationship/rostering records are persisted).
- [ ] If the Postgres transaction fails, the Firebase Auth user is deleted.
- [ ] If any step fails, no orphaned records exist across Firebase and Postgres.

### Validation

- [ ] Returns 400 if password is too short or not provided.
- [ ] Returns 400 if email is invalid or not provided.
- [ ] Returns 400 if `name.first` or `name.last` is not provided.
- [ ] Returns 400 if `location.state` is not a valid state code.
- [ ] Returns 400 if `location.coordinates` is invalid.
- [ ] Returns 400 if `location.country` is not a valid country code.
- [ ] Returns 409 if the email address is already in use.
- [ ] Returns 422 if the email address has already created a family.
- [ ] Returns 500 if an internal server error occurs.
