import jsPsychPreload from '@jspsych/plugin-preload';

// TODO: Handle shared files when using blocks.
export function createPreloadTrials(categorizedObjects, blocks = []) {
  // Initialize jsPsychPreload trial objects for each block
  const trials =
    blocks.length > 0
      ? blocks.reduce((acc, block) => {
          acc[block] = createJsPsychPreloadObject();
          return acc;
        }, {})
      : { default: createJsPsychPreloadObject() };

  // Helper function to check if URL contains a block name as an exact folder name
  const containsBlock = (url, block) => {
    const urlParts = new URL(url).pathname.split('/');
    return urlParts.some((part) => part === block);
  };

  // Distribute URLs into the appropriate blocks
  Object.entries(categorizedObjects).forEach(([category, files]) => {
    Object.entries(files).forEach(([fileName, url]) => {
      let fileAdded = false;

      for (const block of blocks) {
        if (containsBlock(url, block)) {
          trials[block][category].push(url);
          fileAdded = true;
          break;
        }
      }

      // If no block matches, add to default if blocks are empty
      if (!fileAdded && blocks.length === 0) {
        trials.default[category].push(url);
      }
    });
  });

  return trials;
}

function createJsPsychPreloadObject() {
  return {
    type: jsPsychPreload,
    message: 'The experiment is loading',
    show_progress_bar: true,
    continue_after_error: false,
    error_message: '',
    show_detailed_errors: true,
    max_load_time: null,
    on_error: null,
    on_success: null,
    images: [],
    audio: [],
    video: [],
  };
}
