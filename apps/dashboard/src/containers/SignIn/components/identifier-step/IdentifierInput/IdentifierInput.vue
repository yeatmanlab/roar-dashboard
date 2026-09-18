<template>
  <TextInput
    id="email"
    class="mt-4"
    name="email"
    autocomplete="username"
    :label="$t('authSignIn.emailPlaceholder')"
    :placeholder="$t('authSignIn.emailPlaceholder')"
    label-hidden
    :model-value="modelValue"
    :invalid="invalid"
    :error="invalid ? $t('authSignIn.incorrectEmailOrPassword') : ''"
    data-cy="sign-in__username"
    @update:model-value="(value) => $emit('update:modelValue', value)"
    @keydown.enter.prevent="$emit('enter', modelValue)"
  />
</template>

<script setup>
import TextInput from '@/components/Form/TextInput';

defineProps({ modelValue: { type: String, default: '' }, invalid: { type: Boolean, default: false } });
defineEmits(['update:modelValue', 'enter']);
</script>
