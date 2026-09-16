# SelfRegistration boundaries

Release verification and approval status are tracked in
[`QUALITY_ASSURANCE.md`](./QUALITY_ASSURANCE.md).

`SelfRegistration` is Stage 1 of ROAR at Home family onboarding. It creates the
account-owner account before authentication. It does not enroll a learner.

## Open-signup route

- `/register` is available without an invitation or registration code.
- Query parameters named `code`, `invitationCode`, or similar do not select a
  signup experience and are not passed into the registration container.
- `AccountOwnerForm` contains only account-owner, legal-acknowledgement, and
  optional future-contact fields. It contains no invitation-code input.
- `useAccountOwnerForm` remains responsible for owner-field state and
  validation; it has no invitation-code responsibility.

## Research consent

`useResearchConsent` owns research-consent state independently from legal
acceptance and optional future contact. Its default-document loader must not
derive a document from route or invitation-code context. The consent modal loads
the existing `consent-behavioral-eye-tracking` legal document (or its approved
Spanish counterpart). Selecting **Continue** is the explicit confirmation and
keeps the selected document identifier, version metadata, and confirmation time
in a feature-local consent record. Closing or canceling the modal neither creates
that record nor checks the signup acknowledgement.

## Completion behavior

A successful account-creation request does not authenticate or redirect the
owner automatically. The form is replaced by a persistent, personalized success
state with an explicit **Continue to sign in** action. This keeps account creation
and authentication as separate user-visible steps and makes the Stage 1 outcome
clear before navigation.

## Account-creation contract

`AccountOwnerForm` emits a parameterless `submit` event. The container validates
the feature-owned form state and passes only `useAccountOwnerForm.payload` to
`useSelfRegistration`. The workflow maps that payload to the strict
`POST /v1/families/` request body:

| Form value  | API field    | Required |
| ----------- | ------------ | -------- |
| `email`     | `email`      | Yes      |
| `password`  | `password`   | Yes      |
| `firstName` | `name.first` | Yes      |
| `lastName`  | `name.last`  | Yes      |

The endpoint reports an unavailable email as `409` and an existing caretaker
family as `422`; both become actionable sign-in guidance. Other provider and
network failures use the recoverable generic error. There is no separate
preflight email lookup, so the create request remains the source of truth.

The API schema currently does not accept research-consent metadata,
`futureContactAllowed`, or the reCAPTCHA token. These values remain independent
feature state and are intentionally excluded by
`mapParentFormToCreateFamily`; adding server persistence requires an approved
API/backend contract change. The reCAPTCHA token still gates client submission,
but server-side token verification must be completed when that contract exists.

## Migration and rollback

`SelfRegistration` is the only active account-owner signup implementation.
`RegisterFamilyUsers.vue` is a route-only page that renders the container; it
does not own registration state. The legacy `RegisterParent` component and the
intermediate `FamilyRegistration` workflow were removed after the route,
container, mutation, and SignIn boundaries were covered by tests.

The safe rollback point for this cleanup branch is commit `4967d284b`. Reverting
this migration restores the prior adapter and legacy component without changing
the typed create-family endpoint.

## Stage 2 boundary

Learner details, invitation-code entry and validation, invited activities, and
default activity fallback belong to the authenticated `LearnerEnrollment`
feature. They must not be added as child routes, fields, or composables under
`SelfRegistration`.
