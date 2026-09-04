let _config;

export function get_nextCondition() {
  var spacingFactor; // Declare spacingFactor
  var direction; // Declare direction

  if (!testConfig.quest) {
    var poppedValue = shuffledStim.pop(); // Pop the last element from shuffleStimulus
    spacingFactor = poppedValue[0]; // Assign the first part of the popped value to spacingFactor
    direction = poppedValue[1]; // Assign the second part to direction
  } else {
    spacingFactor = jsQUEST.QuestQuantile(quest); // Get the quantile value from jsQUEST
    direction = Math.round(Math.random()); // Randomly set direction to 0 or 1
  }

  var min =
    lowestSpacingDegPossible > testConfig.lowest_criticalSpacing_deg
      ? lowestSpacingDegPossible
      : testConfig.lowest_criticalSpacing_deg;
  var max = testConfig.highest_criticalSpacing_deg;

  if (spacingFactor < min) {
    spacingFactor = min;
  } else if (spacingFactor > max) {
    spacingFactor = max;
  }

  return {
    spacingFactor: spacingFactor,
    direction: direction,
  };
}

export function initQuest() {
  var tGuess = testConfig.initialGuess;
  var tGuessSd = 1;
  var pThreshold = 0.82;
  var beta = 3.5;
  var delta = 0.02;
  var gamma = 1 / answers.length;
  quest = jsQUEST.QuestCreate(tGuess, tGuessSd, pThreshold, beta, delta, gamma);
}

export async function responseBar() {
  fixationStim.style.visibility = 'hidden';
  leftPeripheralStim.style.visibility = 'hidden';
  rightPeripheralStim.style.visibility = 'hidden';
  if (eyeMoved & (count_eyeMoved < 15)) {
    // your eye moved
    showPopUp(
      'Uh Oh, your eyes moved! Keep them on the cross at all times when the cross is present.',
      false,
      'fixationBreak',
    );
  } else {
    if (type === 'Test') {
      document.getElementById('answerTitle').textContent = `Select Answer (Q${count_initTrials}/${
        testConfig.numberofTrials + 1
      })`;
    }
    container_options.style.visibility = 'visible';
  }

  await stopRecording();
  //aryaman recordAnswer, make some other div visible to tell them, start next trial
  const dir = condition.direction == 1 ? 'L' : 'R';
  const timestamp = new Date().getTime();
  _videoURL =
    tempAnswers[0].replace('.svg', '') + '_' + dir + '_' + timestamp + '_' + store.session.get('id') + '.webm';
  const uploadUrl = await saveRecordings({
    filename: _videoURL,
  }); // Save the recorded audio and
  if (eyeMoved) {
    setTimeout(function () {
      recordAnswer('', eyeMoved, uploadUrl);
      init_newTrial();
    }, 5000); // Delay in milliseconds (1000 ms = 1 second)
  }
}

export function calculateMedian(diffs) {
  if (diffs.length === 0) throw new Error('No elements in the array');

  // Sort the array
  diffs.sort((a, b) => a - b);

  const midIndex = Math.floor(diffs.length / 2);

  // Check if the array length is even
  if (diffs.length % 2 === 0) {
    // Median is the average of the two middle numbers
    return (diffs[midIndex - 1] + diffs[midIndex]) / 2;
  } else {
    // Median is the middle element
    return diffs[midIndex];
  }
}

export function isInBetween(position, start, end) {
  return position >= start && position <= end;
}

export function headinPlace() {
  return isAreaWithinRange(fixedContour, movingContour) && isCentroidInsidePath(fixedContour, movingContour);
}

export function shuffleStimulus() {
  if (testConfig.MCL_config && testConfig.MCL_repeat) {
    for (let i = 0; i < testConfig.MCL_repeat; i++) {
      // Shuffle the images array
      var shuffled = testConfig.MCL_config.sort(() => Math.random() - 0.5);
      if (type === 'Practice') {
        shuffled = testConfig.MCL_config_practice.sort(() => Math.random() - 0.5);
        testConfig.quest = false;
      }
      shuffledStim.push(...shuffled);
    }

    for (let i = 1; i < shuffledStim.length; i++) {
      if (shuffledStim[i] === shuffledStim[i - 1]) {
        // Replace with the letter before it
        const hold = shuffledStim[i];
        shuffledStim[i] = shuffledStim[i + 1];
        shuffledStim[i + 1] = hold;
      }
    }
  }
}

export function tanDegrees(angleInDegrees) {
  var angleInRadians = angleInDegrees * (Math.PI / 180);
  return Math.tan(angleInRadians);
}

export function logmar_to_arcmin(value) {
  return Math.pow(10, value);
}

export function arcmin_to_deg(value) {
  return value / 60;
}

export function shuffle(array) {
  let arrCopy = array.slice(); // This creates a new copy of the array
  for (let i = arrCopy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arrCopy[i], arrCopy[j]] = [arrCopy[j], arrCopy[i]]; // Swap elements
  }
  return arrCopy;
}

export function get_PixelsPerDegree(distanceCM, screenWidthPX, screenWidthCM) {
  var OneCmInDegrees = tanDegrees(0.5) * distanceCM * 2;
  var PixelPerCm = screenWidthPX / screenWidthCM;
  var PixelsPerDegree = OneCmInDegrees * PixelPerCm;
  return PixelsPerDegree;
}

export function get_stimulusSize(size_logmar, multiple, PixelsPerDegree) {
  var size_arcmin = logmar_to_arcmin(size_logmar) * multiple;
  var size_deg = arcmin_to_deg(size_arcmin);
  var size_px = size_deg * PixelsPerDegree;
  return size_px;
}

export function get_lowestSpacingDeg(stimulusSizePX, PixelsPerDegree, minSpacingMultiple) {
  var lowestSpacing_px = minSpacingMultiple * stimulusSizePX;
  var lowestSpacing_deg = lowestSpacing_px * (1 / PixelsPerDegree);
  return lowestSpacing_deg;
}

export function initLayout() {
  var leftPos = deviceConfig.screenWidthPX / 2 - eccentricity * PixelsPerDegree;
  var rightPos = deviceConfig.screenWidthPX / 2 + eccentricity * PixelsPerDegree;
  fixationStim.style.width = PixelsPerDegree.toString() + 'px';
  leftPeripheralStim.style.left = leftPos.toString() + 'px';
  rightPeripheralStim.style.left = rightPos.toString() + 'px';
  leftPeripheralStimPosition = parseFloat(leftPeripheralStim.style.left);
  rightPeripheralStimPosition = parseFloat(rightPeripheralStim.style.left);
}

export function createOptions() {
  const container = document.getElementById('container_options');
  const row1 = document.getElementById('row1');
  const row2 = document.getElementById('row2');

  container.addEventListener('click', function (event) {
    // Check if a button was clicked
    if (event.target.tagName === 'BUTTON') {
      const clickedButton = event.target;
      // Get the background image URL
      const backgroundImageUrl = clickedButton.style.backgroundImage.replace('url("', '').replace('")', '');

      // Extract just the filename without the ".svg" extension
      const filename = backgroundImageUrl.split('/').pop();
      // Call a function with the extracted filename
      recordAnswer(filename, false);

      init_newTrial();
    }
  });

  // Populate rows with buttons and images
  for (let i = 0; i < answers.length; i++) {
    const button = document.createElement('button');
    const imageUrl = `${testConfig.dir}/${answers[i]}`;
    button.style.width = '75px';
    button.style.height = '75px';
    button.style.margin = '5px';
    button.style.backgroundImage = `url(${imageUrl})`;
    button.style.backgroundSize = 'contain';
    button.style.backgroundPosition = 'center center';
    button.style.border = 'none'; // Remove button border

    if (i < 10) {
      row1.appendChild(button);
    } else {
      row2.appendChild(button);
    }
  }
}

export function stimulusTemplate(center, left, right, top, bottom, horizontalSpacing_deg, verticalSpacing_deg = 0) {
  // Assuming there is a container div with id 'container'
  const container = document.createElement('div');
  container.style.position = 'relative';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.transform = 'translate(-50%, -50%)';
  container.innerHTML = ''; // Clear previous contents

  // Helper function to create and position elements
  function createStimulus(id, content, x, y) {
    const elem = document.createElement('div');
    elem.style.lineHeight = 'normal';
    elem.id = id;
    elem.innerHTML = `<img src="${testConfig.dir}/${content}" style="width: 100%; height: 100%;">`;
    elem.style.position = 'absolute';
    elem.style.transform = 'translate(-50%, -50%)';
    elem.style.width = stimulusSize.toString() + 'px';
    elem.style.height = 'auto';
    elem.style.left = `${x}px`;
    elem.style.top = `${y}px`;
    container.appendChild(elem);
  }

  // Positions
  const offsetX = horizontalSpacing_deg * PixelsPerDegree; // arbitrary spacing horizontally
  const offsetY = verticalSpacing_deg * PixelsPerDegree; // arbitrary spacing vertically

  // Central element
  createStimulus('centerStim', center, container.offsetWidth / 2, container.offsetHeight / 2);
  // Left and right elements
  createStimulus('leftStim', left, container.offsetWidth / 2 - offsetX, container.offsetHeight / 2);
  createStimulus('rightStim', right, container.offsetWidth / 2 + offsetX, container.offsetHeight / 2);
  // Top and bottom elements
  // createStimulus('topStim', top, container.offsetWidth / 2, container.offsetHeight / 2 - offsetY);
  // createStimulus('bottomStim', bottom, container.offsetWidth / 2, container.offsetHeight / 2 + offsetY);

  return container;
}

export function setConfig(config) {
  _config = config;
}
