import store from 'store2';
import consent_page from './consent.html';

window.store = store;

export async function consentView() {
  // Load the existing HTML page
  // const response = await fetch("https://eyetrackingdata.blob.core.windows.net/public/views/consent.html");
  const consentHtml = consent_page;

  // Create a div and set its innerHTML to the loaded HTML content
  const consentPage = document.createElement('div');
  consentPage.innerHTML = consentHtml;

  // Append the confirmation page to the body or a specific element
  document.body.appendChild(consentPage);

  // Load and execute external scripts
  await loadExternalScripts(consentPage);
  executeInlineScripts(consentPage);

  // Wait for the user to click the "Start Experiment" button
  await new Promise((resolve) => {
    const confirmButton = document.getElementById('confirmButton');
    if (confirmButton) {
      confirmButton.addEventListener('click', () => {
        cleanup(); // Cleanup added scripts
        consentPage.remove(); // Remove the confirmation page
        resolve();
      });
    }
  });
}

function cleanup() {
  // Remove dynamically added script elements from the head
  const dynamicScripts = document.querySelectorAll('script[data-dynamic]');
  dynamicScripts.forEach((script) => script.parentNode.removeChild(script));
}

async function loadExternalScripts(element) {
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
