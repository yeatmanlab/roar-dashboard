import store from "store2";
import menu_page from "./menu.html";

window.store = store;

export async function menuView(tests_url) {
  // Load the existing HTML page
  // const response = await fetch("https://eyetrackingdata.blob.core.windows.net/public/views/menu.html");
  window.tests_url = tests_url;
  const menuHtml = menu_page;

  // Create a div and set its innerHTML to the loaded HTML content
  const menuPage = document.createElement("div");

  menuPage.innerHTML = menuHtml;

  // Append the confirmation page to the body or a specific element
  document.body.appendChild(menuPage);

  // Load and execute external scripts
  await loadExternalScripts(menuPage);
  executeInlineScripts(menuPage);

  // Wait for the user to click the "Start Experiment" button
  await new Promise((resolve) => {
    document.body.addEventListener("click", function (event) {
      if (event.target.id.startsWith("button_")) {
        console.log("Button clicked:", event.target.id);
        cleanup(); // Cleanup added scripts
        menuPage.remove(); // Remove the confirmation page
        resolve();
      }
    });
  });
}

function cleanup() {
  // Remove dynamically added script elements from the head
  const dynamicScripts = document.querySelectorAll("script[data-dynamic]");
  dynamicScripts.forEach((script) => script.parentNode.removeChild(script));
}

async function loadExternalScripts(element) {
  // Extract and load external scripts within the specified element
  const scripts = element.getElementsByTagName("script");
  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i];
    if (script.src) {
      await loadScript(script.src);
    }
  }
}

function executeInlineScripts(element) {
  // Extract and execute inline scripts within the specified element
  const scripts = element.getElementsByTagName("script");
  for (let i = 0; i < scripts.length; i++) {
    const script = document.createElement("script");
    script.text = scripts[i].text;
    document.head.appendChild(script).parentNode.removeChild(script);
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
