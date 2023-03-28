<template>
  <RoarGameCarousel :items="testData" />
</template>

<script setup>
  import {ref} from "vue"; 
  import RoarGameCarousel from "../components/RoarGameCarousel.vue";
  const testData = ref([
    {
      title: "Game 1",
      description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Egestas sed tempus urna et pharetra. Scelerisque fermentum dui faucibus in ornare. Malesuada fames ac turpis egestas sed tempus urna et pharetra. Enim tortor at auctor urna nunc id cursus metus.",
      imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
      metadata: {
        version: "1.2.3",
        coins: "4"
      }
    },
    {
      title: "Game 2",
      description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Egestas sed tempus urna et pharetra. Scelerisque fermentum dui faucibus in ornare. Malesuada fames ac turpis egestas sed tempus urna et pharetra. Enim tortor at auctor urna nunc id cursus metus.",
      imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
      metadata: {
        version: "1.2.3",
        coins: "32K"
      }
    },
    {
      title: "Game 3",
      description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Egestas sed tempus urna et pharetra. Scelerisque fermentum dui faucibus in ornare. Malesuada fames ac turpis egestas sed tempus urna et pharetra. Enim tortor at auctor urna nunc id cursus metus.",
      imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
      metadata: {
        version: "1.2.3",
        coins: "1M"
      }
    },
    {
      title: "Game 4",
      description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Egestas sed tempus urna et pharetra. Scelerisque fermentum dui faucibus in ornare. Malesuada fames ac turpis egestas sed tempus urna et pharetra. Enim tortor at auctor urna nunc id cursus metus.",
      imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
      metadata: {
        version: "1.2.3",
        coins: "4M"
      }
    },
    {
      title: "Game 5",
      description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Egestas sed tempus urna et pharetra. Scelerisque fermentum dui faucibus in ornare. Malesuada fames ac turpis egestas sed tempus urna et pharetra. Enim tortor at auctor urna nunc id cursus metus.",
      imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
      metadata: {
        version: "1.2.3",
        coins: "4M"
      }
    },
    {
      title: "Game 6",
      description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Egestas sed tempus urna et pharetra. Scelerisque fermentum dui faucibus in ornare. Malesuada fames ac turpis egestas sed tempus urna et pharetra. Enim tortor at auctor urna nunc id cursus metus.",
      imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
      metadata: {
        version: "1.2.3",
        coins: "4M"
      }
    },
  ]);
</script>