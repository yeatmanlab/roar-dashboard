<template>
  <div class="flex mx-5 flex-column align-items-center">
    <div class="flex flex-wrap px-2 py-1 rounded justify-content-around align-items-center">
      <div class="flex flex-row items-center text-sm font-light">
        <div
          class="inline-block rounded-full border-5 border-white h-6 w-6 mr-2 align-middle"
          style="background-color: var(--bright-green)"
        />
        <div>
          <div>Completed</div>
        </div>
      </div>
      <div class="flex flex-row items-center text-sm font-light">
        <div
          class="inline-block rounded-full border-5 border-white h-6 w-6 mr-2 align-middle"
          style="background-color: var(--yellow-100)"
        />
        <div>
          <div>Started</div>
        </div>
      </div>
      <div class="flex flex-row items-center text-sm font-light">
        <div
          class="inline-block rounded-full border-5 border-white h-6 w-6 mr-2 align-middle"
          style="background-color: var(--surface-d)"
        />
        <div>
          <div>Assigned</div>
        </div>
      </div>
    </div>
    <div class="my-1 text-xs font-light text-gray-500 uppercase">Legend</div>
  </div>
</template>

<script setup>
// No props needed - this is a static legend component
</script>
