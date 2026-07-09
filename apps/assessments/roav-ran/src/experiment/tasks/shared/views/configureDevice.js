/**
 * @fileoverview module to support configureDeviceView.js
 * @module configureDevice
 */

/**
 * Updates the dropdown options based on available device configurations.
 * If there is only one device available, it automatically selects and handles the device.
 */
export function updateDropdownOptions() {
  const dropdown = document.getElementById("deviceList");
  const collapsableCards = document.getElementById(
    "findDevice-collapsableCards",
  );
  dropdown.innerHTML = ""; // Clear existing options

  // Add a blank option as the first option
  const blankOption = document.createElement("option");
  blankOption.value = "";
  blankOption.text = ""; // or you can add a placeholder text like "Select a device"
  dropdown.add(blankOption);
  // Add options based on deviceConfig
  const deviceNames = Object.keys(deviceConfigs);

  deviceNames.forEach((deviceName) => {
    const option = document.createElement("option");
    option.value = deviceName;
    option.text = deviceName.charAt(0).toUpperCase() + deviceName.slice(1); // Capitalize first letter
    dropdown.add(option);
  });

  // Check if there's only one device available
  if (deviceNames.length === 1) {
    const selectedDeviceConfig = deviceConfigs[deviceNames[0]];

    // Automatically run handleDevice for the single option
    handleDevice(selectedDeviceConfig);

    // Hide the collapsable cards element
    if (collapsableCards) {
      collapsableCards.style.display = "none";
      updateCardNumbers();
    }
  } else {
    // Show the collapsable cards element if more than one option exists
    if (collapsableCards) {
      collapsableCards.style.display = "block";
    }
  }
}

/**
 * Fetches and updates device configurations from a JSON file.
 *
 * @param {string} jsonUrl - URL of the JSON file containing device configurations.
 */
export async function updateDeviceConfigFromJSON(jsonUrl) {
  try {
    const response = await fetch(jsonUrl);
    const jsonData = await response.json();
    // Initialize or update deviceConfig based on JSON data
    deviceConfigs = jsonData;
    // Update dropdown options
    updateDropdownOptions();
  } catch (error) {
    console.error("Error fetching or parsing JSON:", error);
  }
}

/**
 * Handles selection of a device by updating global configuration variables.
 *
 * @param {Object} config - Configuration object of the selected device.
 */
export function handleDevice(config) {
  console.log("You selected a " + config.deviceName);

  screenHeight = config.screenHeight;
  screenWidth = config.screenWidth;
  webcamHeight = config.webcamHeight;

  // screensize
  screenSizeCalibrated = config.screenSizeCalibrated;

  // webcam centered
  webcamCentered = config.webcamCentered;

  // height of webcam
  HeightWebcamEntered = config.HeightWebcamEntered;
  heightInput_textbox.value = webcamHeight;
  heightInput_textbox.disabled = HeightWebcamEntered;

  if (config.hasOwnProperty("normalizedFocalLength")) {
    // normalizedFocalLength exists
    normalizedFocalLength = config.normalizedFocalLength;
  }

  checkAllComplete();

  // collapseCards(config.deviceName !== "Custom");
}

/**
 * Updates the numbering of visible cards dynamically.
 */
export function updateCardNumbers() {
  // Select all elements with the class 'card-title'
  var cards = document.querySelectorAll(".card-title");
  var visibleCardIndex = 1;

  cards.forEach(function (card) {
    // Only update the numbering for visible cards
    if (
      card.parentElement.parentElement.style.display !== "none" &&
      card.parentElement.parentElement.offsetParent !== null
    ) {
      card.textContent = card.textContent.replace(
        /\(\d+\)/,
        "(" + visibleCardIndex + ")",
      );
      visibleCardIndex++;
    }
  });
}

/**
 * Toggles or sets the visibility of collapsable cards.
 *
 * @param {boolean|string} [collapse=true] - Whether to collapse (true), expand (false), or toggle visibility ("Toggle").
 */
export function collapseCards(collapse = true) {
  const cards = document.querySelectorAll('[id*="-collapsableCards"]');

  cards.forEach((card) => {
    if (collapse === "Toggle") {
      // Toggle the display based on the current state
      card.style.display = card.style.display === "none" ? "" : "none";
    } else {
      // Set the display based on the collapse parameter (true or false)
      card.style.display = collapse ? "none" : "";
    }
  });
}

/**
 * Toggles visibility of camera collapsible cards.
 * @param {boolean} [collapse=true] - If true, hide cards; if false, show cards.
 * @returns {void}
 */
export function collapseCamera(collapse = true) {
  const cards = document.querySelectorAll('[id*="-cameracollapsableCards"]');
  //console.log(cards); // Useful for debugging, consider removing in production

  cards.forEach((card) => {
    // Set the display based on the collapse parameter (true or false)
    card.style.display = collapse ? "none" : "";
  });
}

/**
 * Fills the participant's name input field and disables it.
 *
 * @param {string} participant - Name of the participant.
 */
export function inputParticipantName(participant) {
  var idInput = document.getElementById("idInput");
  idInput.value = participant; // Change placeholder
  idInput.disabled = true;
}
