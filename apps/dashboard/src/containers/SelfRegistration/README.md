# SelfRegistration boundaries

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

The feature-local consent record is an ephemeral UI-submission gate, not durable
proof of consent. The strict `POST /v1/families/` contract does not currently
accept consent metadata, and the record is not written to browser storage; it is
discarded when `SelfRegistration` unmounts. Persisting the document identifier,
version, and confirmation time requires an approved API and backend storage
change and must be tracked before this behavior is represented as durable consent
capture. Portuguese locales intentionally use the approved default English
document until a Portuguese consent document is configured and approved.

## Completion behavior

A successful account-creation request does not authenticate or redirect the
owner automatically. The form is replaced by a persistent, personalized success
state with an explicit **Continue to sign in** action. This keeps account creation
and authentication as separate user-visible steps and makes the Stage 1 outcome
clear before navigation.

## Stage 2 boundary

Learner details, invitation-code entry and validation, invited activities, and
default activity fallback belong to the authenticated `LearnerEnrollment`
feature. They must not be added as child routes, fields, or composables under
`SelfRegistration`.
