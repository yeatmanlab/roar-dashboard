/**
 * Shared TestFixture type for backend test server and SDK integration tests.
 *
 * This type is defined once and imported by both:
 * - Producer: apps/backend/src/server-test.ts (writes fixture data)
 * - Consumer: packages/assessment-sdk/src/test-support/sdk-test-helper.ts (reads fixture data)
 *
 * Keeping this type in a single location prevents drift between the producer
 * and consumer, ensuring JSON serialization/deserialization stays in sync.
 */

export interface TestFixture {
  testUser: {
    id: string;
    authId: string;
  };
  schoolATeacher: {
    id: string;
    authId: string;
  };
  administrationAssignedToDistrict: {
    id: string;
  };
  administrationAssignedToDistrictB: {
    id: string;
  };
  variantForAllGrades: {
    id: string;
  };
  variantForGrade5: {
    id: string;
  };
  variantForGrade3: {
    id: string;
  };
  variantOptionalForEll: {
    id: string;
  };
  variantForTask2: {
    id: string;
  };
  variantForTask2Grade5OptionalEll: {
    id: string;
  };
}
