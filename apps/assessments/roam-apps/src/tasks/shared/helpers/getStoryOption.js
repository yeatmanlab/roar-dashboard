import { getGrade } from "@bdelab/roar-utils";

// if storyOption is grade-based then grades K-5 get story and 6+ get non-story mode. If grade is not defined then default is storyMode
export const getStoryOption = (opt, grade) => {
  let story;
  if (opt === 'grade-based') {
    if (getGrade(grade) >= 6) {
      story = false;
    } else {
      story = true;
    }
  } else if (!opt) {
    story = true;
  } else {
    story = opt?.toLocaleLowerCase() === 'true';
  }
  return story;
};
