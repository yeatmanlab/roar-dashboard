import symbol_trial from "./symbolTest.html";
import { 
    ensureSymbolPage, 
    endView, 
    completeTrial, 
    waitForPendingWrites, 
    createStimulusImage, 
    createChoices, 
    playAudioShort 
} from "../helpers/viewHelpers";

const state = {
    symbolPage: null,
    imageRow: null,
    currentTrialResolve: null,
    startTime: null,
    pendingWrites: [],
    bufferTime: null
}

export async function symbolView(config, trial, trial_idx, block_idx, audioMapping) {
    await ensureSymbolPage(state, audioMapping.progressBar, symbol_trial, store.session.get("bufferTimePB")[block_idx]);
    let choiceArr = [];
    let rtArr = [];
    
    populateSymbolRow(config, trial, choiceArr, rtArr, trial_idx, block_idx, audioMapping);

    // start time after the page content has been updated and painted
    requestAnimationFrame(() => {
        state.startTime = performance.now();
        //note down the time of the first trial 
        if (!store.session.get("startTimePB")) {
            store.session.set("startTimePB", state.startTime);
            // start the timer
            const timerId = setTimeout(() => {
                store.session.set("timeOut", true);
            }, store.session.get("timerDuration")[block_idx]);
            store.session.set("timerId", timerId);

            // set an additional timeout for force exiting, to prevent page inactivity
            const timerForceId = setTimeout(() => {
                if (typeof state.currentTrialResolve === "function") {
                    // resolve the promise returned by symbolView (no payload needed)
                    state.currentTrialResolve();
                    state.currentTrialResolve = null;
                }
            }, (store.session.get("timerDuration")[block_idx] + store.session.get("timerForceQuit")));

            store.session.set("timerForceId", timerForceId);

            //start the timer
            startTimer(block_idx);
        }
    });

    return new Promise((resolve) => {
        state.currentTrialResolve = resolve;
    });
}

//add buttons for the trial
function populateSymbolRow(config, trial, choiceArr, rtArr, trial_idx, block_idx, audioMapping) {
    if (!state.imageRow || !trial) return;

    //reset imageRow
    state.imageRow.innerHTML = "";

    //add the target image
    state.imageRow.appendChild(createStimulusImage(trial.dir, trial.target, "target-image hidden-choice"));

    //add the choice buttons
    const choices = Array.isArray(trial.choices) ? trial.choices : [];
    choices.forEach((choiceSrc, index) => {
        //creates button and adds image to it
        const button = createChoices(trial.dir, choiceSrc, "hidden-choice")
        button.addEventListener("click", () => {
            //log all button clicks and response times
            const endTime = performance.now();
            const response_time = Math.round(endTime - state.startTime);
            choiceArr.push(choiceSrc);
            rtArr.push(response_time);
            if(choiceSrc === trial.target) {
                //complete the trial if choice is correct
                playAudioShort(audioMapping.positiveFeedbackSrc);
                //increment trial count
                store.session.transact("trialNumTotal",  (oldVal) => oldVal + 1);
                let save_trial = !store.session.get("timeOut")
                //data to save
                const results = {
                        assessment_stage: "test_response",
                        pid: config.pid,
                        trial_num_block: trial_idx + 1,
                        trial_num_total: store.session.get("trialNumTotal"),
                        item: trial.target,
                        choices: trial.choices,
                        correct_response_num: trial.correctResponseNum,
                        correct: 1,
                        rt: response_time,
                        distractors: trial.distractors,
                        response_choice_list: choiceArr,
                        response_time_list: rtArr,
                        device: store.session.get("device")
                };
                //write data to Firebase
                completeTrial(state, config, results, save_trial);
            } else {
                playAudioShort(audioMapping.negativeFeedbackSrc);
            }
        });

        state.imageRow.appendChild(button);
    });

    //show the buttons after a delay
    const timeDelay1 = setTimeout(() => {
        state.imageRow.querySelector(".target-image").classList.remove("hidden-choice");
    }, store.session.get("timeDelay1"));

    const timeDelay2 = setTimeout(() => {
        state.imageRow.querySelectorAll(".hidden-choice")
            .forEach(btn => btn.classList.remove("hidden-choice"));
    }, store.session.get("timeDelay2"));
}

// To clear the view
export async function endSymbolView() {
    // wait for any outstanding async writes to complete before ending the view
    await waitForPendingWrites(state);
    //clear page
    endView(state);
}

// Update progress bar based on time
function updateProgressBar(remainingTime, totalTime, block_idx) {
    const percent = ((remainingTime / totalTime) + state.bufferTime) * 100;
    document.querySelector('#jspsych-progressbar-inner').style.width = `${percent}%`;
}

//for updating progress bar continously
function startTimer(block_idx) {
    const step = 5;
    const interval = Math.round(1000 / step);
    const countdownTime = 120;
    const totalTime = countdownTime * step; // Total time in seconds
    let remainingTime = 0;

    let intervalId = setInterval(() => {
        remainingTime++;
        updateProgressBar(remainingTime, totalTime, block_idx);
    }, interval);

  store.session.set("intervalId", intervalId);
}