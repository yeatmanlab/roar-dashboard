<template>
  <RoarGameCarousel :items="testData" :focusIndex="1" />
</template>

<script setup>
  import {ref} from "vue"; 
  import RoarGameCarousel from "../components/RoarGameCarousel.vue";
  const testData = ref([
    {
      id: "id-1",
      title: "Game 1",
      description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Egestas sed tempus urna et pharetra. Scelerisque fermentum dui faucibus in ornare. Malesuada fames ac turpis egestas sed tempus urna et pharetra. Enim tortor at auctor urna nunc id cursus metus.",
      imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
      metadata: {
        version: "1.2.3",
        coins: "4"
      },
      completed: false
    },
    {
      id: "id-2",
      title: "Game 2",
      description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Egestas sed tempus urna et pharetra. Scelerisque fermentum dui faucibus in ornare. Malesuada fames ac turpis egestas sed tempus urna et pharetra. Enim tortor at auctor urna nunc id cursus metus.",
      imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
      metadata: {
        version: "1.2.3",
        coins: "32K"
      },
      completed: false
    },
    {
      id: "id-3",
      title: "Game 3",
      description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Egestas sed tempus urna et pharetra. Scelerisque fermentum dui faucibus in ornare. Malesuada fames ac turpis egestas sed tempus urna et pharetra. Enim tortor at auctor urna nunc id cursus metus.",
      imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
      metadata: {
        version: "1.2.3",
        coins: "1M"
      },
      completed: false
    },
    {
      id: "id-4",
      title: "Game 4",
      description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Egestas sed tempus urna et pharetra. Scelerisque fermentum dui faucibus in ornare. Malesuada fames ac turpis egestas sed tempus urna et pharetra. Enim tortor at auctor urna nunc id cursus metus.",
      imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
      metadata: {
        version: "1.2.3",
        coins: "4M"
      },
      completed: false
    },
    {
      id: "id-5",
      title: "Game 5",
      description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Egestas sed tempus urna et pharetra. Scelerisque fermentum dui faucibus in ornare. Malesuada fames ac turpis egestas sed tempus urna et pharetra. Enim tortor at auctor urna nunc id cursus metus.",
      imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
      metadata: {
        version: "1.2.3",
        coins: "4M"
      },
      completed: false
    },
    {
      id: "id-6",
      title: "Game 6",
      description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Egestas sed tempus urna et pharetra. Scelerisque fermentum dui faucibus in ornare. Malesuada fames ac turpis egestas sed tempus urna et pharetra. Enim tortor at auctor urna nunc id cursus metus.",
      imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
      metadata: {
        version: "1.2.3",
        coins: "4M"
      },
      completed: false
    },
  ]);
</script>