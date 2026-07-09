import symbol_trial from "./symbolPractice.html";
import {  
    ensureSymbolPage, 
    endView, 
    completeTrial, 
    waitForPendingWrites, 
    createStimulusImage, 
    createChoices, 
    playAudioLong
} from "../helpers/viewHelpers";
import store from "store2";

const state = {
    symbolPage: null,
    imageRow: null,
    currentTrialResolve: null,
    startTime: null,
    pendingWrites: [],
    currentAudio: null,
    currentAudioResolve: null
}


export async function symbolPracticeView(config, trial, trial_idx, audioMapping) {
    await ensureSymbolPage(state, audioMapping.progressBar, symbol_trial, 0);
    let choiceArr = [];
    let rtArr = [];
    
    populateSymbolRow(config, trial, choiceArr, rtArr, trial_idx, audioMapping.symbolPracticeView);

    // start time after the page content has been updated and painted
    requestAnimationFrame(() => {
        state.startTime = performance.now();
    });

    return new Promise((resolve) => {
        state.currentTrialResolve = resolve;
    });
}



function populateSymbolRow(config, trial, choiceArr, rtArr, trial_idx, audioMapping) {
    if (!state.imageRow || !trial) return;

    //reset feedback
    const feedback = document.querySelector(".feedback");
    feedback.classList.remove("green");
    feedback.classList.remove("gray");
    feedback.classList.add("hidden");
    feedback.textContent = audioMapping.correct.text; // write some text so buttons don't shift up, this will be hidden at first and shown later

    //reset imageRow
    state.imageRow.innerHTML = "";
    
    //add the target image
    state.imageRow.appendChild(createStimulusImage(trial.dir, trial.target, "target-image hidden-choice"));
    
    //add the choice buttons
    const choices = Array.isArray(trial.choices) ? trial.choices : [];
    const buttons = [];
    // counter shared across buttons to track total incorrect attempts within a given trial
    let counter = 0;
    choices.forEach((choiceSrc, index) => {
        //creates button and adds image to it
        const button = createChoices(trial.dir, choiceSrc, "hidden-choice");
        //for feedback functions
        button.dataset.choice = choiceSrc;
        button.addEventListener("click", async () => {
            const endTime = performance.now();
            const response_time = Math.round(endTime - state.startTime);
            choiceArr.push(choiceSrc);
            rtArr.push(response_time);
            if (choiceSrc === trial.target) {
                //complete the trial if choice is correct
                buttonStatesCorrect(buttons, trial.target);
                //play feedback, wait for audio to finish before showing next instruction screen
                await playFeedback(audioMapping.correct, "green");
                //increment trial count
                store.session.transact("trialNumTotal",  (oldVal) => oldVal + 1);
                //data to save
                const results = {
                    assessment_stage: "practice_response",
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
                };

                // write the data to Firebase
                completeTrial(state, config, results, true);
            } else {
                //add glowing button class for correct choice only on the first click
                counter++;  
                if(counter === 1) {
                    await playFeedback(audioMapping.incorrect1, "gray");
                } else if (counter === 2){
                    await playFeedback(audioMapping.incorrect2, "gray");
                } else {
                    buttonStatesIncorrect(buttons, trial.target);
                    await playFeedback(audioMapping.incorrect3[store.session.get("device")], "gray");
                }
            }
        });
        state.imageRow.appendChild(button);
        buttons.push(button);
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
export async function endPracticeSymbolView() {
    // wait for any outstanding async writes to complete before ending the view
    await waitForPendingWrites(state);
    //clear page
    endView(state);
}

// Update button classes when correct response
function buttonStatesCorrect(buttons, correctChoice) {
    buttons.forEach((btn) => {
        btn.disabled = true;
        const btnChoice = btn.dataset.choice;
        if (btnChoice === correctChoice) {
            btn.classList.add("glowingButton");
            btn.classList.add("disabled-btn");
        } 
        else {
            btn.classList.add("disabled-btn-practice");
        }
    });
}

// Update button classes when incorrect response
function buttonStatesIncorrect(buttons, correctChoice) {
    buttons.forEach((btn) => {
        const btnChoice = btn.dataset.choice;
        if (btnChoice === correctChoice) {
            btn.classList.add("glowingButton");
        } 
    });
}

// Show feedback text and play audio
async function playFeedback(audioMapping, color) {
    //show the feedback text
    const feedback = document.querySelector(".feedback");
    feedback.classList.remove("hidden");
    feedback.classList.remove("gray");
    feedback.classList.add(color);
    feedback.innerHTML = audioMapping.text;

    //play feedback audio
    await playAudioLong(audioMapping.audioSrc, state);
}


