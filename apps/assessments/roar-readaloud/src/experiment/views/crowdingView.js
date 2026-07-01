import store from 'store2';
import crowding_page from './crowding.html';
import loadingScreen_page from './loadingScreen.html';
import eyetrackingVars from './eyetrackingVars.html';
import * as initJS from './crowding.js';
import * as headeyetrackingJS from './headeyetracking.js';
import * as videoCaptureJS from './videoCapture.js';

window.store = store;

export async function crowdingView(type, config) {
  var myWorker = new Worker(new URL('./worker.js', import.meta.url), {
    type: 'module',
  });

  window.myWorker = myWorker;

  // Load the existing HTML page
  const viewingDistance = config.firekit.task.variantParams.viewingDistance;
  const quest = config.firekit.task.variantParams.quest;
  window.quest = quest;
  const visibleEyeTracking = config.firekit.task.variantParams.visibleEyeTracking;
  let html = crowding_page;
  const eyetrackingVars_page = document.createElement('div');

  var testConfig = store.session.get('testConfig');
  const fontType = testConfig.dir.split('/')[testConfig.dir.split('/').length - 1];
  eyetrackingVars_page.innerHTML = eyetrackingVars;

  // Create a div and set its innerHTML to the loaded HTML content
  const page = document.createElement('div');
  // Set the div to cover the entire page
  page.style.position = 'fixed';
  page.style.top = '0';
  page.style.left = '0';
  page.style.width = '100%';
  page.style.height = '100%';

  await loadExternalScripts(initJS);
  await loadExternalScripts(videoCaptureJS);
  await loadExternalScripts(headeyetrackingJS);

  // Grab config for saveRecordings
  initJS.setConfig(config);

  page.innerHTML = html;
  const loadingHtml = loadingScreen_page;

  // Append the confirmation page to the body or a specific element
  document.body.appendChild(page);

  // initialise variables
  window.type = type;

  // Load and execute external scripts
  await loadHeadingScripts(page);
  await loadHeadingScripts(eyetrackingVars_page);
  executeInlineScripts(eyetrackingVars_page);
  executeInlineScripts(page);
  DOMloaded(type, fontType, visibleEyeTracking);

  await new Promise((resolve) => {
    document.addEventListener(
      'pageComplete',
      () => {
        const results = {
          assessment_type: 'Crowding',
          assessment_stage: type,
          distance: viewingDistance,
          historyofResults: historyofResults,
          quest: testConfig.quest,
          parentDir: store.session.get('id'),
          deviceConfig: store.session.get('deviceConfig'),
          participantConfig: store.session.get('participantConfig'),
          testConfig: store.session.get('testConfig'),
          correct: 1,
        };

        config.firekit.writeTrial(results);

        unloadExternalScripts(initJS);
        unloadExternalScripts(videoCaptureJS);
        unloadExternalScripts(headeyetrackingJS);
        page.remove();
        cleanup();
        resolve();
      },
      { once: true },
    );
  });
}

function resetStyles(element) {
  element.style.position = ''; // Reset to static, which is the default for most elements
  element.style.top = '';
  element.style.left = '';
  element.style.width = ''; // Resets to auto
  element.style.height = ''; // Resets to auto
}

async function loadExternalScripts(src) {
  Object.keys(src).forEach((key) => {
    window[key] = src[key];
  });
}

function unloadExternalScripts(src) {
  Object.keys(src).forEach((key) => {
    const propDesc = Object.getOwnPropertyDescriptor(window, key);
    if (propDesc && propDesc.configurable) {
      delete window[key];
    } else {
      console.log(`Cannot remove ${key} from window; it may be non-configurable.`);
    }
  });
}

async function DOMloaded(type, fontType, visibleEyeTracking) {
  var voiceover = document.getElementById('voiceover');
  await giveAccess();
  initLayout();
  initQuest();
  shuffleStimulus();
  createOptions();
  initEyeTracking(visibleEyeTracking, visibleEyeTracking);

  // var title = document.getElementById("instructionTitle");
  // title.innerHTML = `<b>${subtestText[0]} ${type} Phase</b>`;

  // // Update Image
  var img = document.getElementById('explanationGif');
  img.src = `https://eyetrackingdata.blob.core.windows.net/public/Images/${fontType}-crowding.png`;

  if (type === 'Practice') {
    // Update description
    var subtitle = document.getElementById('instructionSubtitle');
    subtitle.innerHTML = `Let's do some practice!`;

    // Update description
    var description = document.getElementById('instructionDescription');
    description.innerHTML = `
    <h5>Look at the cross in the middle of the screen.</h5>
    <h5>Soon, you'll see three symbols to the left or right of the cross.</h5>
    <h5><b>Without</b> moving your eyes from the cross, try to guess the <span style="text-decoration: underline; text-decoration-color: red; text-decoration-thickness: 4px;">middle</span> symbol.</h5>
    `;
    voiceover.src = `https://eyetrackingdata.blob.core.windows.net/public/Audios/practiceCrowding.mp3`;
  } else {
    // Update description
    var subtitle = document.getElementById('instructionSubtitle');
    subtitle.innerHTML = `Let’s start for real now.`;

    // Update description
    var description = document.getElementById('instructionDescription');
    description.innerHTML = `
    <h5>Look at the cross in the middle of the screen.</h5>
    <h5>Soon, you'll see three symbols to the left or right of the cross.</h5>
    <h5><b>Without</b> moving your eyes from the cross, try to guess the <span style="text-decoration: underline; text-decoration-color: red; text-decoration-thickness: 4px;">middle</span> symbol.</h5>
    `;

    voiceover.src = `https://eyetrackingdata.blob.core.windows.net/public/Audios/testCrowding.mp3`;
  }
}

function cleanup() {
  // Remove dynamically added script elements from the head
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }

  const dynamicScripts = document.querySelectorAll('script[data-dynamic]');
  dynamicScripts.forEach((script) => script.parentNode.removeChild(script));
}

async function loadHeadingScripts(element) {
  // Extract and load external scripts within the specified element
  const scripts = element.getElementsByTagName('script');
  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i];
    if (script.src) {
      await loadScript(script.src);
    }
  }
}

function executeInlineScripts(element) {
  // Extract and execute inline scripts within the specified element
  const scripts = element.getElementsByTagName('script');
  for (let i = 0; i < scripts.length; i++) {
    const script = document.createElement('script');
    script.text = scripts[i].text;
    document.head.appendChild(script).parentNode.removeChild(script);
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
