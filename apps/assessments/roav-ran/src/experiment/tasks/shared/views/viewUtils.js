/**
 * Shared DOM/script utility functions used across view modules.
 * @module viewUtils
 */

/**
 * Dynamically loads an external script by URL.
 * Skips duplicate insertion by tracking load Promises per absolute URL, rather than
 * relying on document.scripts (which may include inert scripts injected via innerHTML).
 * Tags the created element with `data-dynamic` so it can be removed by cleanupDynamicScripts().
 * @param {string} src - The URL of the script to load.
 * @returns {Promise<void>} Resolves when the script finishes loading, rejects on error.
 */
const scriptLoadPromises = new Map();

export function loadScript(src) {
  const absoluteSrc = new URL(src, document.baseURI).href;

  // If a load is already in progress or completed for this URL, reuse its Promise.
  if (scriptLoadPromises.has(absoluteSrc)) {
    return scriptLoadPromises.get(absoluteSrc);
  }

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = absoluteSrc;
    // Mark as dynamic so cleanupDynamicScripts() can remove it.
    script.dataset.dynamic = "true";
    script.onload = () => {
      resolve();
    };
    script.onerror = (event) => {
      // Allow callers to retry on failure by removing the cached Promise.
      scriptLoadPromises.delete(absoluteSrc);
      reject(event);
    };
    document.head.appendChild(script);
  });

  scriptLoadPromises.set(absoluteSrc, promise);
  return promise;
}

/**
 * Loads all external scripts (those with a `src` attribute) found within an element.
 * @param {HTMLElement} element - The parent element containing script tags.
 * @returns {Promise<void>} Resolves when all external scripts are loaded.
 */
export async function loadScriptsFromElement(element) {
  const scripts = element.getElementsByTagName("script");
  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i];
    if (script.src) {
      await loadScript(script.src);
    }
  }
}

/**
 * Extracts and executes inline scripts found within an element.
 * @param {HTMLElement} element - The parent element containing inline script tags.
 */
export function executeInlineScripts(element) {
  const scripts = element.getElementsByTagName("script");
  for (let i = 0; i < scripts.length; i++) {
    const script = document.createElement("script");
    script.text = scripts[i].text;
    document.head.appendChild(script).parentNode.removeChild(script);
  }
}

/**
 * Assigns all exported keys of a module onto the `window` object.
 * @param {Object} src - The module whose exports should be assigned to `window`.
 */
export function assignModuleToWindow(src) {
  Object.keys(src).forEach((key) => {
    window[key] = src[key];
  });
}

/**
 * Removes previously assigned module keys from the `window` object.
 * @param {Object} src - The module whose exports should be removed from `window`.
 */
export function removeModuleFromWindow(src) {
  Object.keys(src).forEach((key) => {
    const propDesc = Object.getOwnPropertyDescriptor(window, key);
    if (propDesc && propDesc.configurable) {
      delete window[key];
    } else {
      console.log(
        `Cannot remove ${key} from window; it may be non-configurable.`,
      );
    }
  });
}

/**
 * Removes dynamically added script elements (those with `data-dynamic` attribute).
 * @param {function} [filter] - Optional predicate receiving each script element.
 *   If provided, only scripts for which the predicate returns `true` are removed.
 *   If omitted, all dynamic scripts are removed.
 */
export function cleanupDynamicScripts(filter) {
  const dynamicScripts = document.querySelectorAll("script[data-dynamic]");
  dynamicScripts.forEach((script) => {
    if (!filter || filter(script)) {
      script.parentNode.removeChild(script);
    }
  });
}

/**
 * Resets inline positioning styles on an element back to defaults.
 * @param {HTMLElement} element - The element whose styles should be reset.
 */
export function resetStyles(element) {
  element.style.position = "";
  element.style.top = "";
  element.style.left = "";
  element.style.width = "";
  element.style.height = "";
}

/**
 * Updates text content of elements based on translation keys.
 * Elements are matched by their `data-alt-id` attribute.
 * @param {Object} translations - Key-value pairs of translation IDs and text.
 */
export function setLanguage(translations) {
  Object.keys(translations).forEach((key) => {
    // Fallback regex is a rough approximation that only handles special chars.
    // It does not cover edge cases like keys starting with a digit or empty
    // strings. This is acceptable because translation keys are expected to be
    // simple alphanumeric identifiers (e.g. "title", "btn-next").
    const escapedKey = CSS.escape
      ? CSS.escape(key)
      : key.replace(/([^\w-])/g, "\\$1");
    const element = document.querySelector(`[data-alt-id="${escapedKey}"]`);
    if (element) {
      element.textContent = translations[key];
    }
  });
}
