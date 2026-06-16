import { describe, it, expect } from "vitest";
import { toPaScoreEntries } from "./score-entries.js";
import type { PaScoreEntry } from "./score-entries.js";
import { PA_SCORE_NAMES, PA_SCORE_DOMAINS } from "./index.js";

describe("toPaScoreEntries", () => {
  describe("subtask scores (FSM, LSM, DEL)", () => {
    it("maps subtask scores to ScoreEntry array with uppercase domains and generic names", () => {
      const computed = {
        fsm: { numCorrect: 10, numAttempted: 15, percentCorrect: 67 },
        lsm: { numCorrect: 12, numAttempted: 15, percentCorrect: 80 },
        del: { numCorrect: 8, numAttempted: 15, percentCorrect: 53 },
      };

      const entries = toPaScoreEntries(computed);

      // 9 entries: 3 per subtask (correct=raw, attempted=raw, percentCorrect=computed),
      // each under the subtask's UPPERCASE domain (FSM/LSM/DEL).
      expect(entries).toHaveLength(9);

      // Verify FSM entries — uppercase domain, generic names, correct types, TEST stage
      expect(entries).toContainEqual({
        type: "raw",
        domain: PA_SCORE_DOMAINS.FSM,
        name: PA_SCORE_NAMES.NUM_CORRECT,
        value: "10",
        assessmentStage: "test",
      });
      expect(entries).toContainEqual({
        type: "raw",
        domain: PA_SCORE_DOMAINS.FSM,
        name: PA_SCORE_NAMES.NUM_ATTEMPTED,
        value: "15",
        assessmentStage: "test",
      });
      expect(entries).toContainEqual({
        type: "computed",
        domain: PA_SCORE_DOMAINS.FSM,
        name: PA_SCORE_NAMES.PERCENT_CORRECT,
        value: "67",
        assessmentStage: "test",
      });

      // Verify LSM entries
      expect(entries).toContainEqual({
        type: "raw",
        domain: PA_SCORE_DOMAINS.LSM,
        name: PA_SCORE_NAMES.NUM_CORRECT,
        value: "12",
        assessmentStage: "test",
      });
      expect(entries).toContainEqual({
        type: "raw",
        domain: PA_SCORE_DOMAINS.LSM,
        name: PA_SCORE_NAMES.NUM_ATTEMPTED,
        value: "15",
        assessmentStage: "test",
      });
      expect(entries).toContainEqual({
        type: "computed",
        domain: PA_SCORE_DOMAINS.LSM,
        name: PA_SCORE_NAMES.PERCENT_CORRECT,
        value: "80",
        assessmentStage: "test",
      });

      // Verify DEL entries
      expect(entries).toContainEqual({
        type: "raw",
        domain: PA_SCORE_DOMAINS.DEL,
        name: PA_SCORE_NAMES.NUM_CORRECT,
        value: "8",
        assessmentStage: "test",
      });
      expect(entries).toContainEqual({
        type: "raw",
        domain: PA_SCORE_DOMAINS.DEL,
        name: PA_SCORE_NAMES.NUM_ATTEMPTED,
        value: "15",
        assessmentStage: "test",
      });
      expect(entries).toContainEqual({
        type: "computed",
        domain: PA_SCORE_DOMAINS.DEL,
        name: PA_SCORE_NAMES.PERCENT_CORRECT,
        value: "53",
        assessmentStage: "test",
      });
    });

    it("emits numIncorrect when present in subtask scores", () => {
      const computed = {
        fsm: { numCorrect: 10, numAttempted: 15, numIncorrect: 5, percentCorrect: 67 },
      };

      const entries = toPaScoreEntries(computed);

      expect(entries).toContainEqual({
        type: "raw",
        domain: PA_SCORE_DOMAINS.FSM,
        name: PA_SCORE_NAMES.NUM_INCORRECT,
        value: "5",
        assessmentStage: "test",
      });
    });

    it("emits roarScoreKind and scoringVersion when present in subtask scores", () => {
      const computed = {
        fsm: { numCorrect: 10, numAttempted: 15, percentCorrect: 67, roarScoreKind: "raw_total_correct", scoringVersion: 4 },
      };

      const entries = toPaScoreEntries(computed);

      expect(entries).toContainEqual({
        type: "computed",
        domain: PA_SCORE_DOMAINS.FSM,
        name: PA_SCORE_NAMES.ROAR_SCORE_KIND,
        value: "raw_total_correct",
        assessmentStage: "test",
      });
      expect(entries).toContainEqual({
        type: "computed",
        domain: PA_SCORE_DOMAINS.FSM,
        name: PA_SCORE_NAMES.SCORING_VERSION,
        value: "4",
        assessmentStage: "test",
      });
    });

    it("skips null/undefined subtask scores", () => {
      const computed = {
        fsm: { numCorrect: 10, numAttempted: 15, percentCorrect: 67 },
        lsm: { numCorrect: null, numAttempted: 15, percentCorrect: 80 },
        del: { numCorrect: 8, numAttempted: undefined, percentCorrect: 53 },
      };

      const entries = toPaScoreEntries(computed);

      // Null numCorrect for LSM is skipped
      expect(entries).not.toContainEqual(
        expect.objectContaining({ domain: PA_SCORE_DOMAINS.LSM, name: PA_SCORE_NAMES.NUM_CORRECT }),
      );
      // Undefined numAttempted for DEL is skipped
      expect(entries).not.toContainEqual(
        expect.objectContaining({ domain: PA_SCORE_DOMAINS.DEL, name: PA_SCORE_NAMES.NUM_ATTEMPTED }),
      );
    });
  });

  describe("composite scores", () => {
    it("maps composite summary scores with domain=composite and correct types", () => {
      const computed = {
        composite: {
          roarScore: 30,
          percentile: 60,
          sprPercentile: 65,
          sprPercentileString: "65th",
          standardScore: 105,
          sprStandardScore: 108,
          sprStandardScoreString: "108",
        },
      };

      const entries = toPaScoreEntries(computed);

      expect(entries).toContainEqual({
        type: "computed",
        domain: PA_SCORE_DOMAINS.COMPOSITE,
        name: PA_SCORE_NAMES.RAW_SCORE,
        value: "30",
        assessmentStage: "test",
      });
      expect(entries).toContainEqual({
        type: "computed",
        domain: PA_SCORE_DOMAINS.COMPOSITE,
        name: PA_SCORE_NAMES.PERCENTILE,
        value: "60",
        assessmentStage: "test",
      });
      expect(entries).toContainEqual({
        type: "computed",
        domain: PA_SCORE_DOMAINS.COMPOSITE,
        name: PA_SCORE_NAMES.PERCENTILE_SPR,
        value: "65",
        assessmentStage: "test",
      });
      expect(entries).toContainEqual({
        type: "computed",
        domain: PA_SCORE_DOMAINS.COMPOSITE,
        name: PA_SCORE_NAMES.STANDARD_SCORE,
        value: "105",
        assessmentStage: "test",
      });
    });

    it("maps composite raw counts as type=raw", () => {
      const computed = {
        composite: { numCorrect: 30, numAttempted: 45, numIncorrect: 15, percentile: 60 },
      };

      const entries = toPaScoreEntries(computed);

      expect(entries).toContainEqual({
        type: "raw",
        domain: PA_SCORE_DOMAINS.COMPOSITE,
        name: PA_SCORE_NAMES.NUM_CORRECT,
        value: "30",
        assessmentStage: "test",
      });
      expect(entries).toContainEqual({
        type: "raw",
        domain: PA_SCORE_DOMAINS.COMPOSITE,
        name: PA_SCORE_NAMES.NUM_ATTEMPTED,
        value: "45",
        assessmentStage: "test",
      });
      expect(entries).toContainEqual({
        type: "raw",
        domain: PA_SCORE_DOMAINS.COMPOSITE,
        name: PA_SCORE_NAMES.NUM_INCORRECT,
        value: "15",
        assessmentStage: "test",
      });
    });

    it("maps ceilingFlag, categoryScore, roarScoreKind, scoringVersion as computed", () => {
      const computed = {
        composite: {
          roarScore: 30,
          ceilingFlag: true,
          categoryScore: 2,
          roarScoreKind: "scaled_irt",
          scoringVersion: 5,
        },
      };

      const entries = toPaScoreEntries(computed);

      expect(entries).toContainEqual({
        type: "computed",
        domain: PA_SCORE_DOMAINS.COMPOSITE,
        name: PA_SCORE_NAMES.CEILING_FLAG,
        value: "true",
        assessmentStage: "test",
      });
      expect(entries).toContainEqual({
        type: "computed",
        domain: PA_SCORE_DOMAINS.COMPOSITE,
        name: PA_SCORE_NAMES.CATEGORY_SCORE,
        value: "2",
        assessmentStage: "test",
      });
      expect(entries).toContainEqual({
        type: "computed",
        domain: PA_SCORE_DOMAINS.COMPOSITE,
        name: PA_SCORE_NAMES.ROAR_SCORE_KIND,
        value: "scaled_irt",
        assessmentStage: "test",
      });
      expect(entries).toContainEqual({
        type: "computed",
        domain: PA_SCORE_DOMAINS.COMPOSITE,
        name: PA_SCORE_NAMES.SCORING_VERSION,
        value: "5",
        assessmentStage: "test",
      });
    });

    it("maps composite_foundational scores with domain=composite_foundational (adaptive only)", () => {
      const computed = {
        composite_foundational: {
          roarScore: 25,
          percentile: 55,
          sprPercentile: 60,
          sprPercentileString: "60th",
          standardScore: 102,
          sprStandardScore: 105,
          sprStandardScoreString: "105",
        },
      };

      const entries = toPaScoreEntries(computed);

      expect(entries).toHaveLength(7);
      expect(entries).toContainEqual({
        type: "computed",
        domain: PA_SCORE_DOMAINS.COMPOSITE_FOUNDATIONAL,
        name: PA_SCORE_NAMES.RAW_SCORE,
        value: "25",
        assessmentStage: "test",
      });
    });

    it("composite and composite_foundational land under distinct domains", () => {
      const computed = {
        composite: {
          roarScore: 30,
          percentile: 60,
          sprPercentile: 65,
          sprPercentileString: "65th",
          standardScore: 105,
          sprStandardScore: 108,
          sprStandardScoreString: "108",
        },
        composite_foundational: {
          roarScore: 25,
          percentile: 55,
          sprPercentile: 60,
          sprPercentileString: "60th",
          standardScore: 102,
          sprStandardScore: 105,
          sprStandardScoreString: "105",
        },
      };

      const entries = toPaScoreEntries(computed);

      const roarScoreEntries = entries.filter(
        (e: PaScoreEntry) => e.name === PA_SCORE_NAMES.RAW_SCORE,
      );
      const domains = roarScoreEntries.map((e: PaScoreEntry) => e.domain);

      expect(domains).toHaveLength(2);
      expect(domains).toContain(PA_SCORE_DOMAINS.COMPOSITE);
      expect(domains).toContain(PA_SCORE_DOMAINS.COMPOSITE_FOUNDATIONAL);
    });

    it("skips null/undefined composite scores", () => {
      const computed = {
        composite: {
          roarScore: 30,
          percentile: null,
          sprPercentile: undefined,
          standardScore: 105,
        },
      };

      const entries = toPaScoreEntries(computed);

      expect(entries).not.toContainEqual(
        expect.objectContaining({ name: PA_SCORE_NAMES.PERCENTILE }),
      );
      expect(entries).not.toContainEqual(
        expect.objectContaining({ name: PA_SCORE_NAMES.PERCENTILE_SPR }),
      );
    });
  });

  describe("all entries carry assessmentStage=test", () => {
    it("all entries have assessmentStage=test", () => {
      const computed = {
        fsm: { numCorrect: 10, numAttempted: 15, percentCorrect: 67 },
        composite: { roarScore: 30, percentile: 60 },
      };

      const entries = toPaScoreEntries(computed);

      for (const entry of entries) {
        expect(entry.assessmentStage).toBe("test");
      }
    });
  });

  describe("full nested structure (v4 adaptive)", () => {
    it("maps complete adaptive scoring output", () => {
      const computed = {
        fsm: { numCorrect: 10, numAttempted: 15, percentCorrect: 67 },
        lsm: { numCorrect: 12, numAttempted: 15, percentCorrect: 80 },
        del: { numCorrect: 8, numAttempted: 15, percentCorrect: 53 },
        composite: {
          roarScore: 30,
          percentile: 60,
          sprPercentile: 65,
          sprPercentileString: "65th",
          standardScore: 105,
          sprStandardScore: 108,
          sprStandardScoreString: "108",
          thetaEstimate: 0.5,
          thetaSE: 0.1,
        },
        composite_foundational: {
          roarScore: 25,
          percentile: 55,
          sprPercentile: 60,
          sprPercentileString: "60th",
          standardScore: 102,
          sprStandardScore: 105,
          sprStandardScoreString: "105",
          thetaEstimate: 0.3,
          thetaSE: 0.15,
        },
      };

      const entries = toPaScoreEntries(computed);

      // 9 subtask (3 per subtask × 3 subtasks)
      // + 9 composite (7 normed + thetaEstimate + thetaSE)
      // + 9 composite_foundational (same)
      // = 27 entries
      expect(entries.length).toBe(27);

      // All entries have assessmentStage=test
      for (const entry of entries) {
        expect(entry.assessmentStage).toBe("test");
      }

      // All entries have valid domains
      for (const entry of entries) {
        expect([
          PA_SCORE_DOMAINS.FSM,
          PA_SCORE_DOMAINS.LSM,
          PA_SCORE_DOMAINS.DEL,
          PA_SCORE_DOMAINS.COMPOSITE,
          PA_SCORE_DOMAINS.COMPOSITE_FOUNDATIONAL,
        ]).toContain(entry.domain);
      }

      // Subtask counts are raw
      const fsmCorrect = entries.find(
        (e: PaScoreEntry) => e.domain === PA_SCORE_DOMAINS.FSM && e.name === PA_SCORE_NAMES.NUM_CORRECT,
      );
      expect(fsmCorrect).toMatchObject({ type: "raw", value: "10" });

      // Subtask percentCorrect is computed
      const fsmPct = entries.find(
        (e: PaScoreEntry) => e.domain === PA_SCORE_DOMAINS.FSM && e.name === PA_SCORE_NAMES.PERCENT_CORRECT,
      );
      expect(fsmPct).toMatchObject({ type: "computed", value: "67" });

      // Composite theta is raw
      const compositeTheta = entries.find(
        (e: PaScoreEntry) => e.domain === PA_SCORE_DOMAINS.COMPOSITE && e.name === PA_SCORE_NAMES.THETA_ESTIMATE,
      );
      expect(compositeTheta).toMatchObject({ type: "raw", value: "0.5" });

      // Composite roarScore is computed
      const compositeRoar = entries.find(
        (e: PaScoreEntry) => e.domain === PA_SCORE_DOMAINS.COMPOSITE && e.name === PA_SCORE_NAMES.RAW_SCORE,
      );
      expect(compositeRoar).toMatchObject({ type: "computed", value: "30" });
    });

    it("maps complete fixed scoring output (v3)", () => {
      const computed = {
        fsm: { numCorrect: 10, numAttempted: 15, percentCorrect: 67, roarScore: 10 },
        lsm: { numCorrect: 12, numAttempted: 15, percentCorrect: 80, roarScore: 12 },
        del: { numCorrect: 8, numAttempted: 15, percentCorrect: 53, roarScore: 8 },
        composite: {
          roarScore: 30,
          percentile: 60,
          sprPercentile: 65,
          sprPercentileString: "65th",
          standardScore: 105,
          sprStandardScore: 108,
          sprStandardScoreString: "108",
        },
      };

      const entries = toPaScoreEntries(computed);

      // 9 subtask (3 per: numCorrect, numAttempted, percentCorrect — roarScore on
      // subtasks is NOT in SUBTASK_NAMES so it is not emitted)
      // + 7 composite summary names = 16 entries
      expect(entries.length).toBe(16);

      // Verify FSM numCorrect is emitted with uppercase domain
      expect(entries).toContainEqual(
        expect.objectContaining({
          type: "raw",
          domain: PA_SCORE_DOMAINS.FSM,
          name: PA_SCORE_NAMES.NUM_CORRECT,
          value: "10",
        }),
      );
    });

    it("emits theta fields for adaptive scoring (v4+)", () => {
      const computed = {
        fsm: {
          numCorrect: 10,
          percentCorrect: 67,
          thetaEstimate: 0.5,
          thetaSE: 0.15,
        },
        composite: {
          roarScore: 25,
          percentile: 60,
          standardScore: 105,
          thetaEstimate: 0.45,
          thetaSE: 0.12,
          thetaEstimateRaw: 0.4,
          thetaSERaw: 0.13,
        },
      };

      const entries = toPaScoreEntries(computed);

      // Subtask theta is raw under FSM domain
      expect(entries).toContainEqual({
        type: "raw",
        domain: PA_SCORE_DOMAINS.FSM,
        name: PA_SCORE_NAMES.THETA_ESTIMATE,
        value: "0.5",
        assessmentStage: "test",
      });
      expect(entries).toContainEqual({
        type: "raw",
        domain: PA_SCORE_DOMAINS.FSM,
        name: PA_SCORE_NAMES.THETA_SE,
        value: "0.15",
        assessmentStage: "test",
      });

      // Composite theta fields
      expect(entries).toContainEqual({
        type: "raw",
        domain: PA_SCORE_DOMAINS.COMPOSITE,
        name: PA_SCORE_NAMES.THETA_ESTIMATE,
        value: "0.45",
        assessmentStage: "test",
      });
      expect(entries).toContainEqual({
        type: "raw",
        domain: PA_SCORE_DOMAINS.COMPOSITE,
        name: PA_SCORE_NAMES.THETA_SE,
        value: "0.12",
        assessmentStage: "test",
      });
      expect(entries).toContainEqual({
        type: "raw",
        domain: PA_SCORE_DOMAINS.COMPOSITE,
        name: PA_SCORE_NAMES.THETA_ESTIMATE_RAW,
        value: "0.4",
        assessmentStage: "test",
      });
      expect(entries).toContainEqual({
        type: "raw",
        domain: PA_SCORE_DOMAINS.COMPOSITE,
        name: PA_SCORE_NAMES.THETA_SE_RAW,
        value: "0.13",
        assessmentStage: "test",
      });
    });
  });

  describe("strict mode validation", () => {
    it("regression test: composite_foundational is registered", () => {
      const computed = {
        composite_foundational: {
          roarScore: 25,
          percentile: 55,
          sprPercentile: 60,
          sprPercentileString: "60th",
          standardScore: 102,
          sprStandardScore: 105,
          sprStandardScoreString: "105",
        },
      };

      expect(() => toPaScoreEntries(computed, { strict: true })).not.toThrow();
    });

    it("does not throw on unregistered scores in non-strict mode", () => {
      const computed = {
        fsm: { numCorrect: 10, numAttempted: 15, percentCorrect: 67 },
      };

      expect(() => toPaScoreEntries(computed, { strict: false })).not.toThrow();
    });

    it("throws on unregistered input group key in strict mode", () => {
      const computed = {
        fsm: { numCorrect: 10, numAttempted: 15, percentCorrect: 67 },
        unregistered_group: { someScore: 100 },
      };

      expect(() => toPaScoreEntries(computed, { strict: true })).toThrow(
        /unregistered_group/,
      );
    });
  });

  describe("edge cases", () => {
    it("handles empty computed scores object", () => {
      const computed = {};
      const entries = toPaScoreEntries(computed);
      expect(entries).toEqual([]);
    });

    it("handles missing subtasks", () => {
      const computed = {
        fsm: { numCorrect: 10, numAttempted: 15, percentCorrect: 67 },
        // lsm and del missing
      };

      const entries = toPaScoreEntries(computed);

      // Should only have FSM entries (3: numCorrect, numAttempted, percentCorrect)
      const fsmEntries = entries.filter((e: PaScoreEntry) => e.domain === PA_SCORE_DOMAINS.FSM);
      expect(fsmEntries.length).toBe(3);

      const lsmEntries = entries.filter((e: PaScoreEntry) => e.domain === PA_SCORE_DOMAINS.LSM);
      expect(lsmEntries.length).toBe(0);
    });

    it("converts numeric values to strings", () => {
      const computed = {
        fsm: { numCorrect: 10, numAttempted: 15, percentCorrect: 67.5 },
      };

      const entries = toPaScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({ name: PA_SCORE_NAMES.NUM_CORRECT, value: "10" }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: PA_SCORE_NAMES.PERCENT_CORRECT, value: "67.5" }),
      );
    });

    it("preserves subtask order (FSM, LSM, DEL) by domain", () => {
      const computed = {
        del: { numCorrect: 8, numAttempted: 15, percentCorrect: 53 },
        fsm: { numCorrect: 10, numAttempted: 15, percentCorrect: 67 },
        lsm: { numCorrect: 12, numAttempted: 15, percentCorrect: 80 },
      };

      const entries = toPaScoreEntries(computed);

      // Extract per-domain numCorrect indices in output order
      const fsmIndex = entries.findIndex(
        (e: PaScoreEntry) => e.domain === PA_SCORE_DOMAINS.FSM && e.name === PA_SCORE_NAMES.NUM_CORRECT,
      );
      const lsmIndex = entries.findIndex(
        (e: PaScoreEntry) => e.domain === PA_SCORE_DOMAINS.LSM && e.name === PA_SCORE_NAMES.NUM_CORRECT,
      );
      const delIndex = entries.findIndex(
        (e: PaScoreEntry) => e.domain === PA_SCORE_DOMAINS.DEL && e.name === PA_SCORE_NAMES.NUM_CORRECT,
      );

      // Canonical order: FSM, LSM, DEL — even when input is del, fsm, lsm
      expect(fsmIndex).toBeLessThan(lsmIndex);
      expect(lsmIndex).toBeLessThan(delIndex);
    });
  });
});
