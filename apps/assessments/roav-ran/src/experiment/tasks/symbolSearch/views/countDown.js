import countdown_page from "./countDown.html";
import { 
  cleanupDynamicScripts,
 } from "../../shared/views/viewUtils.js";
import { 
    initPageDiv
} from "../helpers/viewHelpers.js";


export async function countDownView() {
  const countDownPage = initPageDiv(countdown_page);
  
  // append the html to the document
  document.body.appendChild(countDownPage);

  let countdown = 4;

  updateCountdown(countdown);

  await new Promise((resolve) => {
    document.addEventListener(
      "pageComplete",
      () => {
        countDownPage.remove();
        cleanupDynamicScripts();
        resolve();
      },
      { once: true },
    );
  });
}


function updateCountdown(countdown) {
  countdown--;

  if (countdown === 0) {
    document.dispatchEvent(new Event('pageComplete'));
  } else {
    document.getElementById("instruction").innerHTML =
      "<h1>" + countdown + "</h1>";
    setTimeout(function () {
      updateCountdown(countdown);
    }, 1000);
  }
}