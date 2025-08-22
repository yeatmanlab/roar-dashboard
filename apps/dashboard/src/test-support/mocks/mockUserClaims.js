import { ref } from 'vue';

const mockUserClaims = ref({
  id: 'mock-claims-document-id',
  collectionValue: 'userClaims',
  lastUpdated: '1725453712887',
  testData: false,
  claims: {
    roarUid: 'mock-roar-uid',
    adminUid: 'mock-admin-uid',
    assessmentUid: 'mock-assessment-uid',
    super_admin: false,
  },
});

const mockPartnerAdminUserClaims = ref({
  ...mockUserClaims.value,
  claims: {
    ...mockUserClaims.value.claims,
    minimalAdminOrgs: ['mock-org-id-1', 'mock-org-id-2'],
    super_admin: false,
  },
});

const mockSuperAdminUserClaims = ref({
  ...mockUserClaims.value,
  claims: {
    ...mockUserClaims.value.claims,
    super_admin: true,
  },
});

export default mockUserClaims;
export { mockUserClaims, mockSuperAdminUserClaims, mockPartnerAdminUserClaims };
