import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { classes, type Class } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import { BaseRepository } from './base.repository';
import { AccessControlFilter } from './utils/access-controls.utils';
import { ClassAccessControls } from './access-controls/class.access-controls';
export class ClassRepository extends BaseRepository<Class, typeof classes> {
  private readonly accessControls: ClassAccessControls;

  constructor(
    db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient,
    accessControls: ClassAccessControls = new ClassAccessControls(db),
  ) {
    super(db, classes);
    this.accessControls = accessControls;
  }

  /**
   * Get a single class by ID, only if the user is authorized to access it.
   *
   * @param accessControlFilter - User ID and allowed roles
   * @param classId - The class ID to retrieve
   * @returns The class if found and accessible, null otherwise
   */
  async getAuthorized(accessControlFilter: AccessControlFilter, classId: string): Promise<Class | null> {
    const accessibleClasses = this.accessControls.buildUserClassIdsQuery(accessControlFilter).as('accessible_classes');

    const result = await this.db
      .select({ class: classes })
      .from(classes)
      .innerJoin(accessibleClasses, eq(classes.id, accessibleClasses.classId))
      .where(eq(classes.id, classId))
      .limit(1);

    return result[0]?.class ?? null;
  }
}
