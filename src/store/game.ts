import { acceptHMRUpdate, defineStore } from 'pinia';
import { parse, stringify } from 'zipson'; // Assuming types are available or handle as 'any' if not

// Define the state interface
interface GameState {
  selectedAdmin: any | undefined; // Use a more specific type if known (e.g., string, object)
  requireRefresh: boolean;
}

// Define the serializer type (basic structure)
interface Serializer {
    deserialize: (value: string) => any;
    serialize: (value: any) => string;
}

export const useGameStore = defineStore('gameStore', { // Changed ID to 'gameStore' as in original JS
  state: (): GameState => ({
    selectedAdmin: undefined,
    requireRefresh: false,
  }),
  actions: {
    requireHomeRefresh(): void { // Added void return type
      this.requireRefresh = true;
    },
  },
  persist: {
    storage: sessionStorage,
    debug: false,
    serializer: {
      deserialize: parse,
      serialize: stringify,
    } as Serializer, // Cast to Serializer interface
  },
});

// HMR (Hot Module Replacement)
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useGameStore, import.meta.hot));
} 