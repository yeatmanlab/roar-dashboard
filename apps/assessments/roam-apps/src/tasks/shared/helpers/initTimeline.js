import store from 'store2';
import { enterFullscreen, getUserDataTimeline } from '../trials';

//randomly generates a 16 character string as the pid
const makePid = () => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 16; i += 1) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
};

//start the timeline with entering into fullscreen and getting some information from user (consent form, lab id, pid, survey)
export const initTimeline = (configMain) => {
  // If the participant's ID was **not** supplied through the query string, then
  // ask the user to fill out a form with their ID, class and school.

  //array of jspsych objects, for entering into full screen, getting lab id, pid, showing consent form, getting some survey data
  const initialTimeline = [
    enterFullscreen,
    ...getUserDataTimeline, //the ... is similar to concatenation when used in array
  ];

  //timeline consists of jspsych objects that start the experiment, before the task (and practice) start
  const beginningTimeline = {
    timeline: initialTimeline,
    on_timeline_finish: async () => {
       
      const config = store.session.get('config');
      config.pid = config.pid || makePid();
      await configMain.firekit.updateUser({
        assessmentPid: config.pid,
        labId: config.labId,
        ...config.userMetadata, //... concantenates the key-variable pairs in config.userMetadata to the rest of the dictionary
      });
    },
  };

  return beginningTimeline;
};
