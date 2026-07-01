import store from 'store2';
import calibrateMicrophone_page from './calibrateMicrophone.html';

window.store = store;

export async function calibrateMicrophoneView() {
  const calibrateMicrophone_html = calibrateMicrophone_page;
  // Create a div and set its innerHTML to the loaded HTML content
  const page = document.createElement('div');
  page.innerHTML = calibrateMicrophone_html;

  // Append the confirmation page to the body or a specific element
  document.body.appendChild(page);

  // Wait for the user to click the "Start Experiment" button

  // Run background noise calibration
  try {
    // Run background noise calibration
    const backgroundNoise = await getBackgroundNoiseLevel();

    // Save background noise level to store
    const deviceConfig = store.session.get('deviceConfig') || {};
    deviceConfig.backgroundNoise = backgroundNoise;
    store.session.set('deviceConfig', deviceConfig);

    console.log('Background noise level obtained:', backgroundNoise);

    // Wait for the user's response to the prompt
    const userResponse = await promptUserForCalibrationConfirmation(page);

    if (userResponse === 'confirm') {
      console.log('User confirmed calibration.');
      page.remove(); // Proceed to the next step
    } else if (userResponse === 'redo') {
      console.log('User chose to redo calibration.');
      page.remove(); // Remove the current page
      await calibrateMicrophoneView(); // Restart calibration
    }
  } catch (err) {
    console.error('Error during calibration:', err);
    page.innerHTML = `<p>Failed to calibrate the microphone. Please try again.</p>`;
  }

  // var backgroundNoise = await getBackgroundNoiseLevel();
  // var deviceConfig = store.session.get("deviceConfig")
  // deviceConfig.backgroundNoise = backgroundNoise
  // store.session.set("deviceConfig",deviceConfig)
  // console.log('Background noise level obtained:', backgroundNoise);
  // page.remove();
}

async function getBackgroundNoiseLevel(durationInSeconds = 5) {
  return new Promise(async (resolve, reject) => {
    try {
      // Request access to the microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create an AudioContext to process the audio
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      // Connect the source to the analyser
      source.connect(analyser);

      // Configure the analyser
      analyser.fftSize = 2048;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const soundLevels = [];
      const startTime = Date.now();

      // Function to capture audio levels over time
      function captureSoundLevel() {
        analyser.getByteFrequencyData(dataArray);

        // Calculate the average sound level in the frequency data
        const avgLevel = dataArray.reduce((a, b) => a + b) / bufferLength;

        // Store the level
        soundLevels.push(avgLevel);

        // Check if the capture duration has exceeded the given time
        if (Date.now() - startTime < durationInSeconds * 1000) {
          // Keep capturing sound levels until the duration is met
          requestAnimationFrame(captureSoundLevel);
        } else {
          // Stop the audio stream and calculate the median noise level
          stream.getTracks().forEach((track) => track.stop());
          audioContext.close();

          // Sort sound levels and calculate the median
          soundLevels.sort((a, b) => a - b);
          const medianLevel = soundLevels[Math.floor(soundLevels.length / 2)];

          // Resolve the promise with the median background noise level
          resolve(medianLevel);
        }
      }

      // Start capturing sound levels
      captureSoundLevel();
    } catch (err) {
      console.error('Error accessing the microphone:', err);
      reject(err); // Reject the promise if there's an error
    }
  });
}

// Function to display the prompt and wait for user response
function promptUserForCalibrationConfirmation(page) {
  return new Promise((resolve) => {
    // Create the prompt with Yes and No buttons
    const promptDiv = document.createElement('div');
    promptDiv.innerHTML = `
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css"
        rel="stylesheet"
      />
      <div class="d-flex flex-column align-items-center justify-content-center text-center" style="min-height: 100vh;">
        <h2>Were you quiet during the calibration?</h2>
        </br>
        <div class="d-flex gap-2">
          <button id="confirmButton" class="btn btn-primary">Yes, continue</button>
          <button id="redoButton" class="btn btn-primary">No, redo calibration</button>
        </div>
      </div>
    `;
    // page.remove()
    // page.innerHTML = promptDiv
    page.innerHTML = '';
    page.appendChild(promptDiv);

    // Add event listeners to resolve the promise based on user input
    document.getElementById('confirmButton').addEventListener('click', () => {
      resolve('confirm');
    });

    document.getElementById('redoButton').addEventListener('click', () => {
      resolve('redo');
    });
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

function cleanup(src) {
  unloadExternalScripts(src);
  // Remove dynamically added script elements from the head
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
