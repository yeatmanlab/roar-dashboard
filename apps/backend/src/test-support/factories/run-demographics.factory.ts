import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { RunDemographics, NewRunDemographics } from '../../db/schema/core';
import { CoreDbClient } from '../../db/clients';
import { runDemographics } from '../../db/schema/core';

/**
 * Factory for creating RunDemographics test objects.
 *
 * Usage:
 * - `RunDemographicsFactory.build()` - Creates in-memory object (unit tests)
 * - `await RunDemographicsFactory.create({ runId, grade })` - Persists to database (integration tests)
 *
 * Note: this table lives in the core DB while runs live in the assessment DB, so
 * `runId` has no FK and a snapshot may legitimately be absent for a run.
 * `schoolLevel` is generated from `grade` by the database and is not insertable.
 */
export const RunDemographicsFactory = Factory.define<RunDemographics>(({ onCreate }) => {
  onCreate(async (demographics) => {
    const insertData: NewRunDemographics = {
      id: demographics.id,
      runId: demographics.runId,
      statusEll: demographics.statusEll,
      statusFrl: demographics.statusFrl,
      statusIep: demographics.statusIep,
      gender: demographics.gender,
      race: demographics.race,
      hispanicEthnicity: demographics.hispanicEthnicity,
      homeLanguage: demographics.homeLanguage,
      ageInMonths: demographics.ageInMonths,
      grade: demographics.grade,
    };

    const [inserted] = await CoreDbClient.insert(runDemographics).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert run demographics');
    return inserted;
  });

  return {
    id: faker.string.uuid(),
    runId: faker.string.uuid(),
    statusEll: null,
    statusFrl: null,
    statusIep: null,
    gender: null,
    race: null,
    hispanicEthnicity: null,
    homeLanguage: null,
    ageInMonths: null,
    grade: '3',
    schoolLevel: null,
    createdAt: new Date(),
    updatedAt: null,
  };
});
