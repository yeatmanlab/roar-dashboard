<template>
  <div class="form-section">
    <div class="p-input-icon-right">
      <label :for="id" class="block mb-1">
        <small class="text-gray-500 font-bold">{{ label }}</small>
        <span v-if="required" class="ml-1 text-gray-500">*</span>
      </label>

      <PvInputText
        :id="id"
        :type="type"
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value)"
        :class="{ 'p-invalid border-red-500': isInvalid || hasErrors }"
        :aria-describedby="ariaDescribedBy"
      />
    </div>
    <span v-if="hasErrors" class="absolute">
      <span v-for="(error, index) of errors" :key="index">
        <small class="text-xs p-error">{{ error.$message }}</small>
      </span>
    </span>
  </div>
</template>

<script setup>
import PvInputText from 'primevue/inputtext';
import { computed } from 'vue';

const props = defineProps({
  id: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    default: 'text',
    validator(value, props) {
      return ['text', 'url'].includes(value);
    },
  },
  modelValue: {
    type: String,
    required: true,
  },
  isInvalid: {
    type: Boolean,
    required: true,
  },
  errors: {
    type: Array,
    required: true,
  },
  ariaDescribedBy: {
    type: String,
    default: '',
  },
  required: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue']);

const hasErrors = computed(() => props.errors.length > 0);
</script>
