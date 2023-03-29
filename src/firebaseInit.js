import firebaseConfig from "./config/firebase";
import { RoarFirekit } from "@bdelab/roar-firekit";

export const roarfirekit = new RoarFirekit({ roarConfig: firebaseConfig, enableDbPersistence: false });
