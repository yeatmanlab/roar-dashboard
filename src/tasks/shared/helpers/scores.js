import _mapValues from "lodash/mapValues";
import _reduce from "lodash/reduce";
import _omit from "lodash/omit";
import store from "store2";
import _round from "lodash/round";
import omit from "lodash/omit";

/**
 * This function calculates computed scores given raw scores for each subtask.
 *
 * The input raw scores are expected to conform to the following interface:
 *
 * interface IRawScores {
 *   [key: string]: {
 *     practice: ISummaryScores;
 *     test: ISummaryScores;
 *   };
 * }
 *
 * where the top-level keys correspond to this assessment's subtasks. If this
 * assessment has no subtasks, then there will be only one top-level key called
 * "total." Each summary score object implements this interface:
 *
 * interface ISummaryScores {
 *   thetaEstimate: number | null;
 *   thetaSE: number | null;
 *   numAttempted: number;
 *   numCorrect: number;
 *   numIncorrect: number;
 * }
 *
 * The returned computed scores must have that same top-level keys as the input
 * raw scores, and each value must be a single number or null.
 *
 * @param {*} rawScores
 * @returns {*} computedScores
 */
export const computedScoreCallback = (rawScores) => {
  // This returns an object with the same top-level keys as the input raw scores
  // But the values are the number of correct trials, not including practice trials.
  const taskName = store.session.get("config").taskName;
  const responseMode = store.session.get("config").responseMode;
  const calculateRawScore = (numCorrect, numIncorrect, subtask) => {
    if (
      (subtask === "FC" && taskName === "fluency-arf") ||
      subtask === "rtControl_2afc" ||
      (subtask !== "symbolicComp" && responseMode === "2afc")
    ) {
      //for 2AFC, score = correct-incorrect
      return Math.max(0, numCorrect - numIncorrect);
    } else if (
      (subtask === "FC" && taskName === "fluency-calf") ||
      subtask === "rtControl_6afc" ||
      responseMode === "6afc"
    ) {
      //for 6AFC, score = correct-0.2*incorrect
      return Math.max(0, _round(numCorrect - 0.2 * numIncorrect, 2));
    } else {
      //for alpaca and fluency production and magpi, score = correct
      return numCorrect;
    }
  };

  const getNumAttempted = (subtask, rawAttempted) => {
    if (store.session.get("responseModality")) {
      //response modality version of ARF and CALF
      if (subtask === "FC") {
        return store.session.get("trialNumTotalAFC");
      } else if (subtask === "FR") {
        return store.session.get("trialNumTotalProduction");
      } else if (subtask === "rtControl_2afc") {
        return store.session.get("trialNumTotalControl2afc");
      } else if (subtask === "rtControl_6afc") {
        return store.session.get("trialNumTotalControl6afc");
      } else {
        return store.session.get("trialNumTotalControlProduction");
      }
    } else if (store.session.get("magpiPilot") && taskName === "fluency-arf") {
      if (subtask !== "composite") {
        return rawAttempted;
      } else {
        return store.session.get("trialNumTotal");
      }
    } else if (taskName === "roam-alpaca" && subtask !== "composite") {
      if (subtask === "numberLine") {
        return rawAttempted;
      }
      //Alpaca subtasks total attempted
      return store.session.get("gradeEstimateObject")[subtask].totalAttempted;
    } else if (taskName !== "roam-alpaca" && subtask !== "composite") {
      //ARF or CALF standard versions
      return rawAttempted; // just use the raw score
    } else {
      //any of the math tasks, composite variable
      return store.session.get("trialNumTotal");
    }
  };

  const calculateRoarScore = (thetaScore) => {
    return Math.round(((thetaScore + 6) * 200) / 3 + 100);
  };

  const getSkillsToWorkOn = () => {
    let skillScores = store.session.get("skillScores");
    let skillsWork = [];

    for (let key in skillScores) {
      if (skillScores[key].flag) {
        skillsWork.push(key);
      }
    }
    return skillsWork;
  };

  const computedScores = _mapValues(rawScores, (subtaskScores, subtask) => {
    let numAttempted = 0;
    let rawScore = 0;
    let numCorrect = 0;
    let numIncorrect = 0;
    if (subtaskScores.hasOwnProperty("test")) {
      numCorrect = subtaskScores.test.numCorrect;
      numIncorrect = subtaskScores.test.numIncorrect;
      numAttempted = getNumAttempted(subtask, subtaskScores.test.numAttempted);
      rawScore = calculateRawScore(numCorrect, numIncorrect, subtask);
    }

    if (subtask !== "composite") {
      let subPercentCorrect = numAttempted != 0 ? numCorrect / numAttempted : 0;
      if (taskName === "roam-alpaca") {
        if (subtask === "numberLine") {
          return {
            numCorrect: numCorrect,
            numIncorrect: numIncorrect,
            numAttempted: numAttempted,
            rawScore: rawScore,
          };
        } else {
          //Alpaca subtasks
          let gradeScore = null;
          let supportCategory = null;
          if (
            store.session.get("gradeEstimateObject").hasOwnProperty(subtask)
          ) {
            gradeScore = store.session.get("gradeEstimateObject")[subtask]
              .gradeScore;
            supportCategory = store.session.get("gradeEstimateObject")[subtask]
              .supportCategory;
          }

          return {
            numCorrect: numCorrect,
            numIncorrect: numIncorrect,
            numAttempted: numAttempted,
            rawScore: rawScore,
            subPercentCorrect: _round(subPercentCorrect, 2),
            gradeEstimate: gradeScore,
            supportLevel: supportCategory,
          };
        }
      } else {
        //ARF and CALF subtasks
        if (
          store.session.get("responseModality") ||
          subtask === "symbolicComp"
        ) {
          return {
            numCorrect: numCorrect,
            numIncorrect: numIncorrect,
            numAttempted: numAttempted,
            rawScore: rawScore,
          };
        } else {
          let assessedSkills = null;
          if (store.session.get("assessedSkills").hasOwnProperty(subtask)) {
            assessedSkills = store.session
              .get("assessedSkills")
              [subtask].join(", ");
          }

          return {
            numCorrect: numCorrect,
            numIncorrect: numIncorrect,
            numAttempted: numAttempted,
            rawScore: rawScore,
            subPercentCorrect: _round(subPercentCorrect, 2),
            skillsAssessed: assessedSkills,
          };
        }
      }
    } else {
      //Any task's Composite: It doesn't matter what's returned because it will be fixed later
      return {
        numCorrect: numCorrect,
        numIncorrect: numIncorrect,
        numAttempted: numAttempted,
        rawScore: rawScore,
      };
    }
  });

  let totalScore, totalNumAttempted;
  let omitList = ["composite"];
  if (store.session.get("responseModality")) {
    omitList = [
      "composite",
      "rtControl_6afc",
      "rtControl_2afc",
      "rtControl_production",
    ];
  } else if (store.session.get("magpiPilot") && taskName === "fluency-arf") {
    omitList = ["composite", "symbolicComp"];
  } else if (store.session.get("magpiPilot") && taskName === "roam-alpaca") {
    omitList = ["composite", "numberLine"];
  }
  if (Object.keys(computedScores).length > 1) {
    if (store.session.get("responseModality")) {
      //for response modality composite
      totalScore = computedScores.hasOwnProperty("FR")
        ? computedScores.FR.rawScore
        : 0;
    } else if (
      (taskName === "fluency-arf" || taskName === "fluency-calf") &&
      responseMode.includes("afc")
    ) {
      //do nothing
    } else {
      totalScore = _reduce(
        _omit(computedScores, omitList),
        (sum, score) => sum + score.rawScore,
        0,
      );
    }

    totalNumAttempted = _reduce(
      _omit(computedScores, omitList),
      (sum, score) => sum + score.numAttempted,
      0,
    );
  } else {
    totalScore = computedScores.composite.rawScore;
    totalNumAttempted = computedScores.composite.numAttempted;
  }

  if (taskName === "roam-alpaca") {
    let thetaScoreRaw = store.session.get("thetaEstimateRaw");
    let thetaScore = store.session.get("thetaEstimate");
    let gradeScore = null;
    let supportCategory = null;
    let totalCorrect = 0;
    if (store.session.get("gradeEstimateObject").hasOwnProperty("composite")) {
      gradeScore = store.session.get("gradeEstimateObject").composite
        .gradeScore;
      supportCategory = store.session.get("gradeEstimateObject").composite
        .supportCategory;
      totalCorrect = store.session.get("gradeEstimateObject").composite
        .totalCorrect;
    }

    //calculated from the IRT theta estimate according to https://roar.stanford.edu/technical/intro-swr.html#sec-swr-scoring
    let roarScore = calculateRoarScore(thetaScore);

    //get the incorrect item skills below grade level
    let incorrectSkills = getSkillsToWorkOn();
    if (incorrectSkills.length > 0) {
      incorrectSkills = incorrectSkills.join(", ");
    }

    computedScores.composite = {
      numCorrect: totalCorrect,
      numIncorrect: totalNumAttempted - totalCorrect,
      numAttempted: totalNumAttempted,
      thetaEstimateRaw: _round(thetaScoreRaw, 2),
      thetaEstimate: _round(thetaScore, 2),
      roarScore: roarScore,
      rawScore: totalScore,
      gradeEstimate: gradeScore,
      supportLevel: supportCategory,
      incorrectSkills: incorrectSkills,
    };
  } else {
    if (store.session.get("responseModality")) {
      computedScores.composite = {
        numCorrect: store.session.get("totalCorrect"),
        numIncorrect: totalNumAttempted - store.session.get("totalCorrect"),
        numAttempted: totalNumAttempted,
        rawScore: totalScore,
      };
    } else {
      let incorrectSkills = store.session.get("incorrectSkills");
      let assessedSkills = store.session.get("assessedSkills");

      let totalCorrect = store.session.get("totalCorrect");
      //calculate total score based on the actual total correct score
      totalScore = calculateRawScore(
        totalCorrect,
        totalNumAttempted - totalCorrect,
        "composite",
      );

      let subPercentCorrect =
        totalNumAttempted != 0 ? totalCorrect / totalNumAttempted : 0;

      let worstFacts = store.session.get("worstFacts");
      for (let i = 0; i < worstFacts.length; i++) {
        if (assessedSkills["multiplication"].includes(worstFacts[i])) {
          if (!incorrectSkills.hasOwnProperty("multiplication")) {
            incorrectSkills["multiplication"] = [];
          }
          incorrectSkills["multiplication"].push(worstFacts[i]);
        }

        if (assessedSkills.hasOwnProperty("division")) {
          if (assessedSkills["division"].includes(worstFacts[i])) {
            if (!incorrectSkills.hasOwnProperty("division")) {
              incorrectSkills["division"] = [];
            }
            incorrectSkills["division"].push(worstFacts[i]);
          }
        }
      }

      Object.keys(incorrectSkills).forEach((key) => {
        incorrectSkills[key] = incorrectSkills[key].join(", ");
      });

      computedScores.composite = {
        numCorrect: totalCorrect,
        numIncorrect: totalNumAttempted - totalCorrect,
        numAttempted: totalNumAttempted,
        subPercentCorrect: _round(subPercentCorrect, 2),
        rawScore: totalScore,
        incorrectSkills: incorrectSkills,
      };
    }
  }

  return computedScores;
};

/**
 * This function normalizes computed scores using participant demographic data.
 *
 * For example, it may return a percentile score and a predicted score on another
 * standardized test.
 *
 * The input computed scores are expected to conform to output of the
 * computedScoreCallback() function, with top-level keys corresponding to this
 * assessment's subtasks and values that are either numbers or null.
 *
 * The returned normalized scores must have that same top-level keys as the input and can
 * have arbitrary nested values. For example, one might return both a percentile
 * score and a predicted Woodcock-Johnson score:
 *
 * {
 *   total: {
 *    percentile: number;
 *    wJPercentile: number;
 *   }
 * }
 *
 * @param {*} computedScores
 * @param {*} demographic_data
 * @returns {*} normedScores
 */
// eslint-disable-next-line no-unused-vars
export const normedScoreCallback = (computedScores, demographic_data) => {
  // TODO: Add table lookup after norms have been collected and established.
  return Object.fromEntries(
    Object.entries(computedScores).map(([key, val]) => [key, val]),
  );
};
