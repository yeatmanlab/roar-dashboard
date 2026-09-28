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
derive a document from route or invitation-code context. The accessible consent
interaction and protocol record are implemented by the dedicated Stage 1
research-consent ticket stacked after the open-signup work.

## Stage 2 boundary

Learner details, invitation-code entry and validation, invited activities, and
default activity fallback belong to the authenticated `LearnerEnrollment`
feature. They must not be added as child routes, fields, or composables under
`SelfRegistration`.
