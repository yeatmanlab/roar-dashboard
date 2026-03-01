# ROAR Dashboard — GitHub Copilot Instructions

This project uses modular AI rules in `.ai/rules/`. When generating code, follow the rules that match the scope of the file being edited:

- **Backend** (`apps/backend/`): `.ai/rules/backend-*.md`
- **Frontend** (`apps/dashboard/`): `.ai/rules/frontend-*.md`
- **Tests**: `.ai/rules/testing-*.md`
- **API contracts** (`packages/api-contract/`): `.ai/rules/api-*.md`

Critical patterns:
1. Backend endpoints follow a 5-layer architecture (Contract > Repository > Service > Controller > Route)
2. Authorization lives in the service/repository layer, never middleware
3. Error messages to clients use generic `ApiErrorMessage` enum values — never expose internal details
4. Controllers are pure HTTP mapping — no business logic or DB access
5. Services use factory functions with dependency injection for testability

See `.ai/rules/README.md` for the full rule index.
