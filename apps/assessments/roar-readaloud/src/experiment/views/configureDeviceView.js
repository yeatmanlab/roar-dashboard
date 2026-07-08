import store from 'store2';
import configureDevice_page from './configureDevice.html';
import loadingScreen_page from './loadingScreen.html';
import * as initJS from './configureDevice';
import { collapseCards, collapseCamera, inputParticipantName, updateDeviceConfigFromJSON } from './configureDevice';
import { getDeviceInfo } from './deviceInformation';
import { openFullscreen } from './videoCapture';

window.store = store;

async function loadExternalScripts(src) {
  Object.keys(src).forEach((key) => {
    window[key] = src[key];
  });
}

function DOMloaded(config) {
  if (config.firekit.task.variantParams.deviceConfigFile !== '') {
    collapseCards('Toggle');
  }

  if (config.firekit.task.variantParams.bEyeTracking == false) {
    collapseCamera();
  }

  console.log('config.firekit.user.assessmentPid', config.firekit.user.assessmentPid);

  if (config.firekit.user.assessmentPid !== '') {
    inputParticipantName(config.firekit.user.assessmentPid);
  }

  const voiceover = document.getElementById('voiceover'); // TO DO: Doesn't have enough time to load? Only plays if the consent screen shows up first
  voiceover.src = `https://eyetrackingdata.blob.core.windows.net/public/Audios/deviceConfig.mp3`;

  if (config.firekit.task.variantParams.deviceConfigFile !== '') {
    const jsonUrl = `https://eyetrackingdata.blob.core.windows.net/public/config/${config.firekit.task.variantParams.deviceConfigFile}.json`;
    updateDeviceConfigFromJSON(jsonUrl);
  }

  voiceover.play();
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

function cleanup(src) {
  unloadExternalScripts(src);
  // Remove dynamically added script elements from the head
  const dynamicScripts = document.querySelectorAll('script[data-dynamic]');
  dynamicScripts.forEach((script) => script.parentNode.removeChild(script));
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

async function loadHeadingScripts(element) {
  // Extract and load external scripts within the specified element
  const scripts = element.getElementsByTagName('script');
  console.log('scripts', scripts);
  const loadPromises = Array.from(scripts).map((script) => {
    if (script.src) {
      return loadScript(script.src);
    }
    return Promise.resolve();
  });
  await Promise.all(loadPromises);
}

function executeInlineScripts(element) {
  // Extract and execute inline scripts within the specified element
  const scripts = element.getElementsByTagName('script');
  Array.from(scripts).forEach((script) => {
    const scriptElement = document.createElement('script');
    scriptElement.text = script.text;
    document.head.appendChild(scriptElement).parentNode.removeChild(scriptElement);
  });
}

export async function configureDeviceView(config) {
  store.session.set('clickedTests', []);
  store.session.set('testComplete', false);

  const configureDeviceHtml = configureDevice_page;
  const loadingHtml = loadingScreen_page;
  // Create a div and set its innerHTML to the loaded HTML content
  const page = document.createElement('div');
  page.innerHTML = configureDeviceHtml;

  // Append the confirmation page to the body or a specific element
  document.body.appendChild(page);

  // Load and execute external scripts
  await loadHeadingScripts(page);
  await loadExternalScripts(initJS);
  executeInlineScripts(page);
  DOMloaded(config);

  // Wait for the user to click the "Start Experiment" button
  await new Promise((resolve) => {
    const confirmButton = document.getElementById('confirmButton');
    if (confirmButton) {
      confirmButton.addEventListener('click', async () => {
        try {
          // const id = `${assessmentUid}_`;
          // + (idInput_textbox.value.trim() ? idInput_textbox.value : makeid(10));
          var id =
            store.session.get('config').firekit.user.assessmentUid +
            '_' +
            (idInput_textbox.value.trim() ? idInput_textbox.value : makeid(10));

          if (id !== config.firekit.user.assessmentPid) {
            config.firekit.updateUser({ assessmentPid: id });
          }

          openFullscreen();

          store.session.set('id', id);
          store.session.set('deviceConfig', {
            screenWidth: parseFloat(screenWidth),
            screenHeight: parseFloat(screenHeight),
            screenWidthPX: parseFloat(screenWidthPX),
            screenHeightPX: parseFloat(screenHeightPX),
            webcamHeight: parseFloat(webcamHeight),
            normalizedFocalLength: parseFloat(normalizedFocalLength),
            deviceInfo: getDeviceInfo(),
            webcamInfo: webcamInfo,
            bEyeTracking: config.firekit.task.variantParams.bEyeTracking,
            storeVideo: config.firekit.task.variantParams.storeVideo,
            backgroundNoise: 0,
          });

          page.innerHTML = loadingHtml;

          cleanup(initJS); // Cleanup added scripts
          page.remove(); // Remove the page
          resolve();
        } catch (error) {
          window.console.log('Error:', error);
        }
      });
    }
  });
}
