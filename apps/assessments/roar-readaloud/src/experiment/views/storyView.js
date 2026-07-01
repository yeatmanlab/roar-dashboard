import store from 'store2';
import story_page from './story.html';

window.store = store;

// Function to call the story trials based on stage
export async function storyView(stage, config) {
  const storyHtml = story_page;

  // Create a div and set its innerHTML to the loaded HTML content
  const storyPage = document.createElement('div');
  storyPage.innerHTML = storyHtml;

  // Append the confirmation page to the body or a specific element
  document.body.appendChild(storyPage);

  window.stage = stage;

  // (these 2 lines were missing, these lines load the scripts inside the tag <script> on the html page)
  await loadExternalScripts(storyPage);
  executeInlineScripts(storyPage);

  // load scripts after DOMloaded
  DOMloaded(stage);

  await new Promise((resolve) => {
    document.addEventListener(
      'pageComplete',
      () => {
        storyPage.remove();
        cleanup();
        resolve();
      },
      { once: true },
    ); // Listener will automatically remove itself after firing once
  });
}

function DOMloaded(stage) {
  startNextView();
}

function removeEventListeners() {
  var oldBody = document.body;
  var newBody = oldBody.cloneNode(true);
  oldBody.parentNode.replaceChild(newBody, oldBody);
}

function cleanup() {
  // Remove dynamically added script elements from the head
  removeEventListeners();
  const dynamicScripts = document.querySelectorAll('script[data-dynamic]');
  dynamicScripts.forEach((script) => {
    const scriptContent = script.textContent || script.innerText;
    if (!scriptContent.includes("voiceover.addEventListener('ended'")) {
      script.parentNode.removeChild(script);
    }
  });
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
