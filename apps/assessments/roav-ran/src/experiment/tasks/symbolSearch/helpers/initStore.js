import store from "store2"; //storing browser data
import { getDevice } from "@bdelab/roar-utils";

export function initStore () {
    // clear any timers if they exist in the browser
    if (store.session.get("timerId")) {
        clearTimeout(store.session.get("timerId"));
    }
    store.session.set("timerId", null);

    if (store.session.get("timerForceId")) {
        clearTimeout(store.session.get("timerForceId"));
    }
    store.session.set("timerForceId", null);

    if (store.session.get("intervalId")) {
        clearInterval(store.session.get("intervalId"));
    }
    store.session.set("intervalId", null);

    store.session.set("numBlocks", 2);
    store.session.set("timerDuration", [60000, 60000]);
    store.session.set("totalTimePB", [120000, 120000]);
    store.session.set("bufferTimePB", [0, 0.5]);
    store.session.set("timerForceQuit", 5000);
    store.session.set("timeDelay1", 250);
    store.session.set("timeDelay2", 600);
    store.session.set("timeOut", false);
    store.session.set("startTimePB", null);
    store.session.set("corpusAll", null);
    store.session.set("trialNumTotal", 0);
    store.session.set("device", getDevice());
}