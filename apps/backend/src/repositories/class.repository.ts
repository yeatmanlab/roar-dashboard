import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { classes, type Class } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import { BaseRepository } from './base.repository';
import { AccessControlFilter } from './utils/parse-access-control-filter.utils';
import { ClassAccessControls } from './access-controls/class.access-controls';
import { OrgAccessControls } from './access-controls/org.access-controls';
export class ClassRepository extends BaseRepository<Class, typeof classes> {
  private readonly classAccessControls: ClassAccessControls;
  private readonly orgAccessControls: OrgAccessControls;

  constructor(
    db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient,
    classAccessControls: ClassAccessControls = new ClassAccessControls(db),
    orgAccessControls: OrgAccessControls = new OrgAccessControls(db),
  ) {
    super(db, classes);
    this.classAccessControls = classAccessControls;
    this.orgAccessControls = orgAccessControls;
  }

  /**
   * Used in verifiedClass
   * Get a single class by ID, only if the user is authorized to access it.
   *
   * @param accessControlFilter - User ID and allowed roles
   * @param classId - The class ID to retrieve
   * @returns The class if found and accessible, null otherwise
   */
  async getAuthorizedById(accessControlFilter: AccessControlFilter, classId: string): Promise<Class | null> {
    const accessibleClasses = this.orgAccessControls
      .buildUserAccessibleOrgIdsQuery(accessControlFilter)
      .as('accessible_classes');

    const result = await this.db
      .select({ class: classes })
      .from(classes)
      .innerJoin(accessibleClasses, eq(classes.schoolId, accessibleClasses.orgId))
      .where(eq(classes.id, classId))
      .limit(1);

    return result[0]?.class ?? null;
  }

  /**
   * Changed
   * User in service to check if has supervisory role
   * @param userId
   * @param classId
   * @returns
   */
  /*async getUserRolesForClass(userId: string, classId: string): Promise<string[]> {
    return this.classAccessControls.getUserRolesForClass(userId, classId);
  }

  async listUsers(accessControlFilter: AccessControlFilter, classId: string): Promise<User[]> {
    
  }*/
}
