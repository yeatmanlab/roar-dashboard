import { defineStore } from "pinia";
import { parse, stringify } from "zipson";

export const useGameStore = () => {
  return defineStore({
    id: "gameStore",
    state: () => {
      return {
        selectedAdmin: "",
      };
    },
    persist: {
      storage: sessionStorage,
      debug: false,
      serializer: {
        deserialize: parse,
        serialize: stringify,
      },
    },
  })();
};
