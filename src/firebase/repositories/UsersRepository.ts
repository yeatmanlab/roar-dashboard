import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';
import { ROLES } from '@/constants/roles';
import { Repository } from '@/firebase/Repository';
import { FirebaseService } from '@/firebase/Service';
import { logger } from '@/logger';
import type {
  GetAdministrationOrgProgressApiResponse,
  GetAdministrationOrgProgressPayload,
  GetAdministrationOrgProgressResult,
} from '@/types/administrationOrgProgress';
import {
  collection,
  getDocs,
  query,
  Timestamp,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

export interface CreateUpdateSuperAdminNamePayload {
  first: string;
  middle?: string;
  last: string;
}

export interface CreateUpdateSuperAdminRolePayload {
  role: string;
  siteId: string;
  siteName: string;
}

export interface CreateUpdateSuperAdminPayload {
  email: string;
  name: CreateUpdateSuperAdminNamePayload;
  roles: CreateUpdateSuperAdminRolePayload[];
  adminUid?: string;
  isTestData?: boolean;
}

export interface CreateUpdateAdministratorPayload {
  email: string;
  name: CreateUpdateSuperAdminNamePayload;
  roles: CreateUpdateSuperAdminRolePayload[];
  adminUid?: string;
  isTestData?: boolean;
}

const CREATE_USERS_CALLABLE_TIMEOUT_MS = 540_000;

export interface CreateUsersPayload {
  users: Record<string, unknown>[];
  siteId?: string;
}

const ADMIN_ROLES = new Set<string>([ROLES.SUPER_ADMIN, ROLES.SITE_ADMIN, ROLES.ADMIN, ROLES.RESEARCH_ASSISTANT]);

function roleEntryHasAdminRole(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object' || !('role' in entry)) {
    return false;
  }
  const role = (entry as { role?: string }).role;
  return typeof role === 'string' && ADMIN_ROLES.has(role);
}

function documentHasAnyAdminRole(data: DocumentData): boolean {
  const roles = data.roles;
  if (!Array.isArray(roles)) {
    return false;
  }
  return roles.some(roleEntryHasAdminRole);
}

function documentHasSuperAdminRole(data: DocumentData): boolean {
  const roles = data.roles;
  if (!Array.isArray(roles)) {
    return false;
  }
  return roles.some((r) => r && typeof r === 'object' && (r as { role?: string }).role === ROLES.SUPER_ADMIN);
}

function serializeUserSnapshot(doc: QueryDocumentSnapshot<DocumentData>): DocumentData & { id: string } {
  const data = doc.data();
  const out: DocumentData & { id: string } = { id: doc.id, ...data };
  const createdAt = data.createdAt;
  if (createdAt instanceof Timestamp) {
    out.createdAt = createdAt.toDate().toISOString();
  }
  return out;
}

class UsersRepository extends Repository {
  constructor() {
    super();
  }

  async fetchAdminUsers(options: { superAdminsOnly?: boolean } = {}): Promise<(DocumentData & { id: string })[]> {
    const { superAdminsOnly = false } = options;

    try {
      const usersRef = collection(FirebaseService.db, FIRESTORE_COLLECTIONS.USERS);
      const usersQuery = query(usersRef, where('roles', '!=', null));
      const snapshot = await getDocs(usersQuery);

      let users = snapshot.docs.map(serializeUserSnapshot).filter(documentHasAnyAdminRole);

      if (superAdminsOnly) {
        users = users.filter((u) => documentHasSuperAdminRole(u));
      }

      return users;
    } catch (error) {
      console.error('fetchAdminUsers: Error fetching admin users from Firestore:', error);
      logger.error(error, { context: { function: 'fetchAdminUsers', superAdminsOnly } });
      throw error;
    }
  }

  async createUpdateSuperAdmin(payload: CreateUpdateSuperAdminPayload): Promise<unknown> {
    return this.call<CreateUpdateSuperAdminPayload, unknown>('createUpdateSuperAdmin', payload);
  }

  async createUpdateAdministrator(payload: CreateUpdateAdministratorPayload): Promise<unknown> {
    if (payload.adminUid) {
      return this.call<CreateUpdateAdministratorPayload, unknown>('updateAdministrator', payload);
    }
    return this.call<CreateUpdateAdministratorPayload, unknown>('createAdministrator', payload);
  }

  async createUsers(payload: CreateUsersPayload): Promise<unknown> {
    return this.callWithTimeout<CreateUsersPayload, unknown>('createUsers', payload, CREATE_USERS_CALLABLE_TIMEOUT_MS);
  }

  async getAdministrationOrgProgress(
    payload: GetAdministrationOrgProgressPayload,
  ): Promise<GetAdministrationOrgProgressResult> {
    const response = await this.call<GetAdministrationOrgProgressPayload, GetAdministrationOrgProgressApiResponse>(
      'getAdministrationOrgProgress',
      payload,
    );

    if (response?.status !== 'ok' || response.data == null) {
      throw new Error('getAdministrationOrgProgress: invalid response from server');
    }

    return response.data;
  }
}

export const usersRepository = new UsersRepository();
