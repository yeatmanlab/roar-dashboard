import firebaseConfig from "./config/firebase";
import { RoarFirekit } from "@bdelab/roar-firekit";
import { markRaw } from "vue";

export const roarfirekit = new RoarFirekit({ roarConfig: firebaseConfig, enableDbPersistence: false, authPersistence: 'session' });

export function initNewFirekit() {
  return new RoarFirekit({ roarConfig: firebaseConfig, enableDbPersistence: false, authPersistence: 'session' })
}