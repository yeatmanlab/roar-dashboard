import { doc, getDoc, type DocumentData } from 'firebase/firestore';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';
import { Repository } from '@/firebase/Repository';
import { FirebaseService } from '@/firebase/Service';
import { logger } from '@/logger';

interface GetAdministrationsParams {
  idsOnly: boolean;
  testData: boolean;
}

interface Administration {
  id: string;
}

interface GetAdministrationsResponse {
  data: Administration[];
}

const ORG_COLLECTION_BY_ROUTE_TYPE: Record<string, string> = {
  district: FIRESTORE_COLLECTIONS.DISTRICTS,
  school: FIRESTORE_COLLECTIONS.SCHOOLS,
  class: FIRESTORE_COLLECTIONS.CLASSES,
  group: FIRESTORE_COLLECTIONS.GROUPS,
};

class AdministrationsRepository extends Repository {
  constructor() {
    super();
  }

  async getAdministrations(params?: GetAdministrationsParams): Promise<Administration[]> {
    const response = await this.call<GetAdministrationsParams, GetAdministrationsResponse>(
      'getAdministrations',
      params,
    );

    return response.data;
  }

  async fetchAdministrationById(administrationId: string): Promise<(DocumentData & { id: string }) | null> {
    try {
      const ref = doc(FirebaseService.db, FIRESTORE_COLLECTIONS.ADMINISTRATIONS, administrationId);
      const snapshot = await getDoc(ref);
      if (!snapshot.exists()) {
        return null;
      }
      return { id: snapshot.id, ...snapshot.data() };
    } catch (error) {
      console.error('fetchAdministrationById: Error fetching administration from Firestore:', error);
      logger.error(error, { context: { function: 'fetchAdministrationById', administrationId } });
      throw error;
    }
  }

  async fetchOrgBySingularRouteType(orgType: string, orgId: string): Promise<(DocumentData & { id: string }) | null> {
    const collectionId = ORG_COLLECTION_BY_ROUTE_TYPE[orgType];
    if (!collectionId) {
      throw new Error(`Unsupported org type for Firestore fetch: ${orgType}`);
    }
    try {
      const ref = doc(FirebaseService.db, collectionId, orgId);
      const snapshot = await getDoc(ref);
      if (!snapshot.exists()) {
        return null;
      }
      return { id: snapshot.id, ...snapshot.data() };
    } catch (error) {
      console.error('fetchOrgBySingularRouteType: Error fetching org from Firestore:', error);
      logger.error(error, { context: { function: 'fetchOrgBySingularRouteType', orgType, orgId } });
      throw error;
    }
  }
}

export const administrationsRepository = new AdministrationsRepository();
