import store from 'store2';
import test_page from './Test.html';
import loadingScreen_page from './loadingScreen.html';
import * as initJS from './Test.js';
import * as headeyetrackingJS from './headeyetracking.js';
import * as videoCaptureJS from './videoCapture.js';
import { Cat } from '@bdelab/jscat';

window.store = store;

export async function TestView(type, config) {
  // Load the existing HTML page
  // const response = await fetch("https://eyetrackingdata.blob.core.windows.net/public/views/RAN.html");

  let confirmationHtml = test_page;

  // Create a div and set its innerHTML to the loaded HTML content
  const TestPage = document.createElement('div');
  // Set the div to cover the entire page
  TestPage.style.position = 'fixed';
  TestPage.style.top = '0';
  TestPage.style.left = '0';
  TestPage.style.width = '100%';
  TestPage.style.height = '100%';

  const viewingDistance = config.firekit.task.variantParams.viewingDistance;
  var cat = new Cat({
    method: 'MLE',
    itemSelect: 'MFI',
    nStartItems: 0,
    theta: 0,
    minTheta: -6,
    maxTheta: 6,
  });
  window.cat = cat;

  await loadExternalScripts(initJS);
  await loadExternalScripts(videoCaptureJS);
  await loadExternalScripts(headeyetrackingJS);

  // Grab config for saveRecordings
  initJS.setConfig(config);

  TestPage.innerHTML = confirmationHtml;
  const loadingHtml = loadingScreen_page;

  // Append the confirmation page to the body or a specific element
  document.body.appendChild(TestPage);

  // initialise variables
  window.type = type;

  // Load and execute external scripts
  await loadHeadingScripts(TestPage);
  executeInlineScripts(TestPage);

  DOMloaded(type);

  await new Promise((resolve) => {
    document.addEventListener(
      'pageComplete',
      () => {
        const results = {
          assessment_type: 'Phonics',
          assessment_stage: type,
          distance: viewingDistance,
          historyofResults: historyofResults,
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
        TestPage.remove(); // Remove the confirmation page
        cleanup();
        resolve();
      },
      { once: true },
    );
  });
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

async function DOMloaded(type) {
  // await giveAccess();
  await initLayout();
  // initQuest();
  shuffleStimulus();
  // createOptions();
  // initEyeTracking(visibleEyeTracking, visibleEyeTracking);

  var title = document.getElementById('instructionTitle');
  var testConfig = store.session.get('testConfig');
  title.innerHTML = type.toLowerCase() === 'practice' ? `<b>Practice Phase</b>` : '';

  if (testConfig['testname'] === 'BlockA') {
    var subtestText = ['block-A', 'words'];
  } else {
    var subtestText = ['block-B', 'words'];
  }

  var voiceover = document.getElementById('voiceover');

  // Update Image
  // var img = document.getElementById("explanationGif");
  // img.src = `https://eyetrackingdata.blob.core.windows.net/public/Images/phonics.gif`;

  var img = document.getElementById('explanationGif');

  if (type === 'Practice') {
    // Update description
    var subtitle = document.getElementById('instructionSubtitle');
    subtitle.innerHTML = `Welcome to ROAR Read Aloud!`;

    // Update description
    var description = document.getElementById('instructionDescription');
    description.innerHTML = `
    <p>In this activity, you are going to see some made-up ${subtestText[1]}.</p>
    <span id="distance-span"></span>
    `;
    // the lion image
    img.src = 'https://eyetrackingdata.blob.core.windows.net/public/Images/lion.gif';

    // img.src = `https://eyetrackingdata.blob.core.windows.net/public/Images/phonicsInstruction1.gif`;

    voiceover.src = `https://eyetrackingdata.blob.core.windows.net/public/Audios/read_words_welcome.mp3`;

    setTimeout(() => {
      updateInstruction();
    }, 6000);
  } else {
    // Update description
    var subtitle = document.getElementById('instructionSubtitle');
    // subtitle.innerHTML = `You are ready to begin!`;

    // Update description
    var description = document.getElementById('instructionDescription');
    description.innerHTML = `
    <p style="line-height: normal;">Remember to read each word clearly and accurately. Press 'Start' to begin!</p>
    <span id="distance-span"></span>
    `;
    img.src = `https://eyetrackingdata.blob.core.windows.net/public/Images/lion.gif`;

    voiceover.src = `https://eyetrackingdata.blob.core.windows.net/public/Audios/read_words_instruction4.mp3`;

    document.getElementById('startTestButton').style.display = 'inline-block';
  }
}

let updateInstruction_count = 0;
const timeout = 5000; // Set your desired timeout duration in milliseconds

function updateInstruction() {
  var subtitle = document.getElementById('instructionSubtitle');
  subtitle.innerHTML = ``;
  updateInstruction_count += 1;

  var description = document.getElementById('instructionDescription');
  var img = document.getElementById('explanationGif');
  img.src = '';

  switch (updateInstruction_count) {
    case 1:
      description.innerHTML = `
        <p>Your job is to read each word out loud.</p>
        <span id="distance-span"></span>
      `;
      // img.src = `https://eyetrackingdata.blob.core.windows.net/public/Images/phonicsInstruction2.gif`;
      // the lion image
      img.src = 'https://eyetrackingdata.blob.core.windows.net/public/Images/lion.gif';
      voiceover.src = `https://eyetrackingdata.blob.core.windows.net/public/Audios/read_words_instruction1.mp3`;

      setTimeout(() => {
        img.src = '';
        updateInstruction();
      }, 3000);

      break;

    case 2:
      description.innerHTML = `
        <p>When the button turns yellow, press it to go to the next word.</p>
        <span id="distance-span"></span>
      `;

      img.src = `https://eyetrackingdata.blob.core.windows.net/public/Images/read_words_instruction2.gif`;

      voiceover.src = `https://eyetrackingdata.blob.core.windows.net/public/Audios/read_words_instruction2.mp3`;

      setTimeout(() => {
        img.src = '';
        updateInstruction();
      }, timeout);
      break;

    case 3:
      description.innerHTML = `
        <p>Press the 'start' button to practice!</p>
        <span id="distance-span"></span>
      `;

      // the lion image
      img.src = 'https://eyetrackingdata.blob.core.windows.net/public/Images/lion.gif';

      voiceover.src = `https://eyetrackingdata.blob.core.windows.net/public/Audios/read_words_instruction3.mp3`;

      // Show the start button
      document.getElementById('startTestButton').style.display = 'inline-block';

      break;

    default:
      // Optional: handle any other cases or reset the counter if needed
      console.log('All instructions shown.');
      break;
  }
}
function removeEventListeners() {
  var oldBody = document.body;
  var newBody = oldBody.cloneNode(true);
  oldBody.parentNode.replaceChild(newBody, oldBody);
}

function cleanup() {
  removeEventListeners();
  // Remove dynamically added script elements from the head
  // function removeAllEventListeners(element) {
  //   const oldElement = element;
  //   const newElement = oldElement.cloneNode(true);
  //   oldElement.parentNode.replaceChild(newElement, oldElement);
  // }

  // // Remove event listeners from specific elements
  // const buttons = document.querySelectorAll("button");
  // buttons.forEach((button) => {
  //   removeAllEventListeners(button);
  // });

  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }

  const dynamicScripts = document.querySelectorAll('script[data-dynamic]');
  dynamicScripts.forEach((script) => script.parentNode.removeChild(script));
  dynamicScripts.forEach((script) => {
    const scriptContent = script.textContent || script.innerText;
    if (!scriptContent.includes("voiceover.addEventListener('ended'")) {
      script.parentNode.removeChild(script);
    }
  });
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
