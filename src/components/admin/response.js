import { ref } from 'vue';
import { ChallengeV3 } from 'vue-recaptcha';
import { __VLS_internalComponent } from './reCaptcha.vue';

const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
export const response = ref(null);
export const isChecked = ref(false);
export const isLoading = ref(false);
export async function handleCheckboxChange() {
if (!isLoading.value) {
isLoading.value = true;

// Simulate API call completion after 1 second
await new Promise(resolve => {
setTimeout(() => {
console.log("response: ", response.value);
// Update isChecked value after loading completes
isChecked.value = true;
isLoading.value = false;
resolve();
}, 1000);
});
}
}
const __VLS_componentsOption = {};
let __VLS_name!: 'reCaptcha';
function __VLS_template() {
let __VLS_ctx!: InstanceType<__VLS_PickNotAny<typeof __VLS_internalComponent, new () => {}>> & {};
/* Components */
let __VLS_otherComponents!: NonNullable<typeof __VLS_internalComponent extends { components: infer C; } ? C : {}> & typeof __VLS_componentsOption;
let __VLS_own!: __VLS_SelfComponent<typeof __VLS_name, typeof __VLS_internalComponent & (new () => { $slots: typeof __VLS_slots; })>;
let __VLS_localComponents!: typeof __VLS_otherComponents & Omit<typeof __VLS_own, keyof typeof __VLS_otherComponents>;
let __VLS_components!: typeof __VLS_localComponents & __VLS_GlobalComponents & typeof __VLS_ctx;
/* Style Scoped */
type __VLS_StyleScopedClasses = {};
let __VLS_styleScopedClasses!: __VLS_StyleScopedClasses | keyof __VLS_StyleScopedClasses | (keyof __VLS_StyleScopedClasses)[];
/* CSS variable injection */
/* CSS variable injection end */
let __VLS_resolvedLocalAndGlobalComponents!: {} &
__VLS_WithComponent<'ChallengeV3', typeof __VLS_localComponents, "ChallengeV3", "ChallengeV3", "ChallengeV3">;
__VLS_intrinsicElements.div; __VLS_intrinsicElements.div;
__VLS_components.ChallengeV3; __VLS_components.ChallengeV3;
// @ts-ignore
[ChallengeV3, ChallengeV3,];
__VLS_intrinsicElements.label; __VLS_intrinsicElements.label;
__VLS_intrinsicElements.span; __VLS_intrinsicElements.span; __VLS_intrinsicElements.span; __VLS_intrinsicElements.span; __VLS_intrinsicElements.span; __VLS_intrinsicElements.span; __VLS_intrinsicElements.span; __VLS_intrinsicElements.span;
__VLS_intrinsicElements.input;
{
const __VLS_0 = __VLS_intrinsicElements["div"];
const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
const __VLS_2 = __VLS_1({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_1));
({} as (props: __VLS_FunctionalComponentProps<typeof __VLS_0, typeof __VLS_2> & Record<string, unknown>) => void)({ ...{}, });
const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2)!;
let __VLS_4!: __VLS_NormalizeEmits<typeof __VLS_3.emit>;
{
const __VLS_5 = ({} as 'ChallengeV3' extends keyof typeof __VLS_ctx ? { 'ChallengeV3': typeof __VLS_ctx.ChallengeV3; } : typeof __VLS_resolvedLocalAndGlobalComponents).ChallengeV3;
const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({ ...{}, modelValue: ((__VLS_ctx.response)), action: ("submit"), }));
({} as { ChallengeV3: typeof __VLS_5; }).ChallengeV3;
({} as { ChallengeV3: typeof __VLS_5; }).ChallengeV3;
const __VLS_7 = __VLS_6({ ...{}, modelValue: ((__VLS_ctx.response)), action: ("submit"), }, ...__VLS_functionalComponentArgsRest(__VLS_6));
({} as (props: __VLS_FunctionalComponentProps<typeof __VLS_5, typeof __VLS_7> & Record<string, unknown>) => void)({ ...{}, modelValue: ((__VLS_ctx.response)), action: ("submit"), });
const __VLS_8 = __VLS_pickFunctionalComponentCtx(__VLS_5, __VLS_7)!;
let __VLS_9!: __VLS_NormalizeEmits<typeof __VLS_8.emit>;
{
const __VLS_10 = __VLS_intrinsicElements["label"];
const __VLS_11 = __VLS_elementAsFunctionalComponent(__VLS_10);
const __VLS_12 = __VLS_11({ ...{}, class: ("recaptcha-checkbox"), }, ...__VLS_functionalComponentArgsRest(__VLS_11));
({} as (props: __VLS_FunctionalComponentProps<typeof __VLS_10, typeof __VLS_12> & Record<string, unknown>) => void)({ ...{}, class: ("recaptcha-checkbox"), });
const __VLS_13 = __VLS_pickFunctionalComponentCtx(__VLS_10, __VLS_12)!;
let __VLS_14!: __VLS_NormalizeEmits<typeof __VLS_13.emit>;
({ 'loading': __VLS_ctx.isLoading });
if (!__VLS_ctx.isLoading) {
{
const __VLS_15 = __VLS_intrinsicElements["span"];
const __VLS_16 = __VLS_elementAsFunctionalComponent(__VLS_15);
const __VLS_17 = __VLS_16({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_16));
({} as (props: __VLS_FunctionalComponentProps<typeof __VLS_15, typeof __VLS_17> & Record<string, unknown>) => void)({ ...{}, });
const __VLS_18 = __VLS_pickFunctionalComponentCtx(__VLS_15, __VLS_17)!;
let __VLS_19!: __VLS_NormalizeEmits<typeof __VLS_18.emit>;
{
const __VLS_20 = __VLS_intrinsicElements["input"];
const __VLS_21 = __VLS_elementAsFunctionalComponent(__VLS_20);
const __VLS_22 = __VLS_21({ ...{ onChange: {} as any, }, type: ("checkbox"), checked: ((__VLS_ctx.isChecked)), }, ...__VLS_functionalComponentArgsRest(__VLS_21));
({} as (props: __VLS_FunctionalComponentProps<typeof __VLS_20, typeof __VLS_22> & Record<string, unknown>) => void)({ ...{ onChange: {} as any, }, type: ("checkbox"), checked: ((__VLS_ctx.isChecked)), });
const __VLS_23 = __VLS_pickFunctionalComponentCtx(__VLS_20, __VLS_22)!;
let __VLS_24!: __VLS_NormalizeEmits<typeof __VLS_23.emit>;
let __VLS_25 = { 'change': __VLS_pickEvent(__VLS_24['change'], ({} as __VLS_FunctionalComponentProps<typeof __VLS_21, typeof __VLS_22>).onChange) };
__VLS_25 = { change: (__VLS_ctx.handleCheckboxChange) };
}
{
const __VLS_26 = __VLS_intrinsicElements["span"];
const __VLS_27 = __VLS_elementAsFunctionalComponent(__VLS_26);
const __VLS_28 = __VLS_27({ ...{}, class: ("recaptcha-checkmark"), }, ...__VLS_functionalComponentArgsRest(__VLS_27));
({} as (props: __VLS_FunctionalComponentProps<typeof __VLS_26, typeof __VLS_28> & Record<string, unknown>) => void)({ ...{}, class: ("recaptcha-checkmark"), });
const __VLS_29 = __VLS_pickFunctionalComponentCtx(__VLS_26, __VLS_28)!;
let __VLS_30!: __VLS_NormalizeEmits<typeof __VLS_29.emit>;
({ 'checked': __VLS_ctx.isChecked });
}
(__VLS_18.slots!).default;
}
// @ts-ignore
[response, response, response, isLoading, isLoading, isChecked, isChecked, handleCheckboxChange, isChecked,];
}
{
const __VLS_31 = __VLS_intrinsicElements["span"];
const __VLS_32 = __VLS_elementAsFunctionalComponent(__VLS_31);
const __VLS_33 = __VLS_32({ ...{}, class: ("recaptcha-loader"), }, ...__VLS_functionalComponentArgsRest(__VLS_32));
({} as (props: __VLS_FunctionalComponentProps<typeof __VLS_31, typeof __VLS_33> & Record<string, unknown>) => void)({ ...{}, class: ("recaptcha-loader"), });
const __VLS_34 = __VLS_pickFunctionalComponentCtx(__VLS_31, __VLS_33)!;
let __VLS_35!: __VLS_NormalizeEmits<typeof __VLS_34.emit>;
__VLS_directiveFunction(__VLS_ctx.vShow)((__VLS_ctx.isLoading));
}
{
const __VLS_36 = __VLS_intrinsicElements["span"];
const __VLS_37 = __VLS_elementAsFunctionalComponent(__VLS_36);
const __VLS_38 = __VLS_37({ ...{}, class: ("recaptcha-label"), }, ...__VLS_functionalComponentArgsRest(__VLS_37));
({} as (props: __VLS_FunctionalComponentProps<typeof __VLS_36, typeof __VLS_38> & Record<string, unknown>) => void)({ ...{}, class: ("recaptcha-label"), });
const __VLS_39 = __VLS_pickFunctionalComponentCtx(__VLS_36, __VLS_38)!;
let __VLS_40!: __VLS_NormalizeEmits<typeof __VLS_39.emit>;
(__VLS_39.slots!).default;
}
(__VLS_13.slots!).default;
}
(__VLS_8.slots!).default;
}
(__VLS_3.slots!).default;
}
if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
}
var __VLS_slots!: {};
// @ts-ignore
[isLoading,];
return __VLS_slots;
}
