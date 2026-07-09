import store from 'store2';
import { Cat } from '@bdelab/jscat';
import _round from 'lodash/round';

export const initGradeEstimate = (gradeEstimateObject, subtask) => {
  gradeEstimateObject[subtask] = {
    zeta: [],
    response: [],
    minGrade: 11,
    maxGrade: -1,
    gradeScore: null,
    supportCategory: null,
    totalCorrect: 0,
    totalAttempted: 0,
  };
};

export const updateGradeEstimateObject = (gradeEstimateObject, subtask, zetaGrade, correct, grade) => {
  if (!gradeEstimateObject.hasOwnProperty(subtask)) {
    //initialise the grade estimate object for the sub task
    initGradeEstimate(gradeEstimateObject, subtask);
  }
  gradeEstimateObject[subtask].totalCorrect = gradeEstimateObject[subtask].totalCorrect + correct;
  gradeEstimateObject[subtask].totalAttempted = gradeEstimateObject[subtask].totalAttempted + 1;
  gradeEstimateObject[subtask].zeta.push(zetaGrade);
  gradeEstimateObject[subtask].response.push(correct);
  if (gradeEstimateObject[subtask].minGrade > grade) {
    gradeEstimateObject[subtask].minGrade = grade;
  }
  if (gradeEstimateObject[subtask].maxGrade < grade) {
    gradeEstimateObject[subtask].maxGrade = grade;
  }
};

const getGradeEstimate = (minGrade, maxGrade, zeta, response) => {
  const cat = new Cat({
    method: 'EAP',
    minTheta: minGrade - 1,
    maxTheta: maxGrade + 1,
    priorDist: 'unif',
    priorPar: [minGrade - 1, maxGrade + 1],
  });
  cat.updateAbilityEstimate(zeta, response);
  return _round(cat.theta, 2);
};

const getSupportCategory = (gradeScore, grade, totalCorrect) => {
  let supportCategory;
  let window = 0.5;
  if (totalCorrect === 0) {
    //no green support category
    if (gradeScore >= grade - 2 - window) {
      supportCategory = 'Developing Skill';
    } else if (gradeScore < grade - 2 - window) {
      supportCategory = 'Needs Extra Support';
    } else {
      supportCategory = null;
    }
  } else {
    if (gradeScore >= grade - window) {
      supportCategory = 'Achieved Skill';
    } else if (gradeScore < grade - window && gradeScore >= grade - 2 - window) {
      supportCategory = 'Developing Skill';
    } else if (gradeScore < grade - 2 - window) {
      supportCategory = 'Needs Extra Support';
    } else {
      supportCategory = null;
    }
  }

  return supportCategory;
};

const getSupportComposite = (gradeScore, subtask, totalCorrect) => {
  let grade = store.session.get('cc_grade');
  let maxGrade = store.session.get('subSkillRange')[subtask].maxGrade;

  //if the student's grade is more than the max grade level for the subskill then color based on the max grade
  if (grade > maxGrade) {
    grade = maxGrade;
  }
  let supportCategory = getSupportCategory(gradeScore, grade, totalCorrect);
  return supportCategory;
};

export const computeAllGradeEstimates = () => {
  let gradeEstimateObject = store.session.get('gradeEstimateObject');

  //compute the cat grade estimate and level color
  Object.keys(gradeEstimateObject).forEach((key) => {
    gradeEstimateObject[key].gradeScore = getGradeEstimate(
      gradeEstimateObject[key].minGrade,
      gradeEstimateObject[key].maxGrade,
      gradeEstimateObject[key].zeta,
      gradeEstimateObject[key].response,
    );
    gradeEstimateObject[key].supportCategory = getSupportComposite(
      gradeEstimateObject[key].gradeScore,
      key,
      gradeEstimateObject[key].totalCorrect,
    );
  });
  store.session.set('gradeEstimateObject', gradeEstimateObject);
};
