<template>
  <div class="card">
    <form @submit.prevent="handleFormSubmit(!v$.$invalid)" class="p-fluid">
      <section class="form-section flex lg:flex-row ">
        <div>
          <label for="firstName">First Name <span class="required p-1">*</span></label>
          <InputText name="firstName" v-model="v$.firstName.$model"  :class="{ 'p-invalid': v$.firstName.$invalid && submitted }" aria-describedby="first-name-error"/>
          <span v-if="v$.firstName.$error && submitted">
            <span v-for="(error, index) of v$.firstName.$errors" :key="index">
              <small class="p-error">{{ error.$message }}</small>
            </span>
          </span>
          <small v-else-if="(v$.firstName.$invalid && submitted) || v$.firstName.$pending.$response" class="p-error">
            {{ v$.firstName.required.$message.replace("Value", "First Name") }}
          </small>
        </div>
        <div>
          <label for="lastName">Last Name <span class="required p-1">*</span></label>
          <InputText name="lastName" v-model="v$.lastName.$model" :class="{ 'p-invalid': v$.firstName.$invalid && submitted }" aria-describedby="first-name-error"/>
          <span v-if="v$.lastName.$error && submitted">
            <span v-for="(error, index) of v$.lastName.$errors" :key="index">
              <small class="p-error">{{ error.$message }}</small>
            </span>
          </span>
          <small v-else-if="(v$.lastName.$invalid && submitted) || v$.lastName.$pending.$response" class="p-error">
            {{ v$.lastName.required.$message.replace("Value", "Last Name") }}
          </small>
        </div>  
      </section>
      <!--Username / Email-->
      <section class="form-section flex lg:flex-row">
        <div class="p-input-icon-right">
          <label for="ParentEmail">Email <span class="required p-1">*</span></label>
          <InputText
            v-model="v$.ParentEmail.$model" 
            name="ParentEmail"
            :class="{ 'p-invalid': v$.ParentEmail.$invalid && submitted }" 
            aria-describedby="username-or-email-error"
          />
        </div>
        <span v-if="v$.ParentEmail.$error && submitted">
          <small class="p-error">Please enter a valid email address.</small>
        </span>
        <small v-else-if="(v$.ParentEmail.$invalid && submitted) || v$.ParentEmail.$pending.$response" class="p-error">
          {{ v$.ParentEmail.required.$message.replace("Value", "Email") }}
        </small>
      </section>
      <!--Password-->
      <section class="form-section flex lg:flex-row">
        <div>
          <div>
            <label for="password">Password <span class="required p-1">*</span></label>
            <Password v-model="v$.password.$model" name="password" :class="{ 'p-invalid': v$.password.$invalid && submitted }" toggleMask show-icon="pi pi-eye-slash" hide-icon="pi pi-eye" :feedback="false"></Password>
          </div>
          <span v-if="v$.password.$error && submitted">
            <span v-for="(error, index) of v$.password.$errors" :key="index">
              <small class="p-error">{{ error.$message }}</small>
            </span>
          </span>
          <small v-else-if="(v$.password.$invalid && submitted) || v$.password.$pending.$response" class="p-error">
            {{ v$.password.required.$message.replace("Value", "Password") }}
          </small>
        </div>
        <!--Confirm Password-->
        <div>
          <div>
            <label for="confirmPassword">Confirm Password <span class="required p-1">*</span></label>
            <Password :id="`confirmPassword-${isRegistering ? 'register' : 'login'}`" v-model="v$.confirmPassword.$model" name="confirmPassword"
              :class="{ 'p-invalid': v$.confirmPassword.$invalid && submitted }" toggleMask show-icon="pi pi-eye-slash" hide-icon="pi pi-eye" :feedback="false">
            </Password>
          </div>
          <small v-if="(v$.confirmPassword.$invalid && submitted) || v$.confirmPassword.$pending.$response" class="p-error">
            Passwords must match
          </small>
        </div>
      </section>
      <!--Accept Checkbox-->
      <section class="form-section flex lg:flex-row">
        <!-- Recaptcha + consent -->
        <ChallengeV3 v-model="response" action="submit">
          <div class="field-checkbox terms-checkbox">
            <Checkbox :id="`accept-${isRegistering ? 'register' : 'login'}`" name="accept" binary :disabled="showConsent"
              v-model="v$.accept.$model" :class="{ 'p-invalid': v$.accept.$invalid && submitted }" @change="getConsent"/>
            <label for="accept" :class="{ 'p-error': v$.accept.$invalid && submitted }">I agree to the terms and conditions<span class="required">*</span></label>
          </div>
          <small v-if="(v$.accept.$invalid && submitted) || v$.accept.$pending.$response" class="p-error">
              You must agree to the terms and conditions
          </small>
        </ChallengeV3>
      </section>
      <ConsentModal v-if="showConsent" :consent-text="consentText" consent-type="consent" @accepted="handleConsentAccept" />
      <div class="form-submit">
        <Button type="submit" label="Next" class="submit-button" :disabled="isNextButtonDisabled"/>
      </div>
    </form>
  </div>
</template>

<script setup>
import { computed, reactive, ref, toRaw, watch, defineEmits, defineComponent } from "vue";
import { required, sameAs, minLength, } from "@vuelidate/validators";
import { useVuelidate } from "@vuelidate/core";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/store/auth";
import { isMobileBrowser } from "@/helpers";
import ConsentModal from "../ConsentModal.vue";
import _get from 'lodash/get'
// import ChallengeV3 from "../admin/reCaptcha.vue"
import { ChallengeV3 } from 'vue-recaptcha';

const router = useRouter()
const authStore = useAuthStore()
const isCaptchaverified = ref(null);

const props = defineProps({
  isRegistering: {type: Boolean, default: true},

});

const emit = defineEmits(['submit']);

const state = reactive({
  // activationCode: "",
  firstName: "",
  lastName: "",
  password: "",
  confirmPassword: "",
  accept: false,
});
const passwordRef = computed(() => state.password);



const ParentEmail = (value) => {
  if (!value.includes('@')) return true;

  const emailRegex = /^(?!.*@.*@)[a-zA-Z0-9]+([._]?[a-zA-Z0-9]+)*(@[a-zA-Z0-9]+([.-]?[a-zA-Z0-9]+)*(\.[a-zA-Z]{2,7})+)?$/;
  return emailRegex.test(value);
} 

const rules = {
  // activationCode: { required },
  firstName: { required },
  lastName: { required },
  ParentEmail: { 
    required, 
    ParentEmail
  },
  password: { 
    required,
    minLength: minLength(6),
  },
  confirmPassword: { required, sameAsPassword: sameAs(passwordRef) },
  accept: { sameAs: sameAs(true) },
};

const response = ref(null);


async function handleCheckCaptcha() {
    await new Promise(resolve => {
      // Simulate a delay to ensure the reCAPTCHA value is updated
      setTimeout(() => {
        console.log("Recaptcha response:", response.value);
        resolve();
        handleCaptcha();
      }, 500); // You might adjust the delay time if needed
    });
  
}

const submitted = ref(false);

const v$ = useVuelidate(rules, state);

const handleFormSubmit = (isFormValid) => {
  console.log("about to admit: ", state)
  submitted.value = true
  if (!isFormValid) {
    return;
  }
  emit('submit', state)
};

function handleCaptcha(){
  isCaptchaverified.value = response.value;
}

const resetForm = () => {
  state.firstName = "";
  state.lastName = "";
  state.email = "";
  state.password = "";
  state.confirmPassword = "";
  submitted.value = false;
};

const showConsent = ref(false);
const consentText = ref("");
let consentVersion = "";

async function handleConsentAccept() {
  state.accept = true;
  // Need to create 'legal' object to send into the user submit object.
}

async function getConsent() {
  const consentDoc = await authStore.getLegalDoc("consent");
  consentText.value = consentDoc.text;
  consentVersion = consentDoc.version;
  showConsent.value = true
  handleCheckCaptcha();
}

const isNextButtonDisabled = computed(() => {
  // Return true (button disabled) if isCaptchaverified is null or undefined
  return isCaptchaverified.value === null || isCaptchaverified.value === undefined;
});


</script>

<style scoped>
.submit-button {
  margin: auto;
  margin-top: .5rem;
  margin-bottom: .5rem;
  display: flex;
  background-color: #E5E5E5;
  color: black;
  border: none;
  width: 11.75rem;
}
.submit-button:hover {
  background-color: #b7b5b5;
  color: black;
}
.terms-checkbox {
  margin-top: 0;
  margin-bottom: 0.75rem;
}
.required {
    color: var(--bright-red);
  }
  label {
    width: 100%;
}

@media screen and (max-width: 580px)
{
  section{ flex-direction: column !important;}
  input.p-inputtext.p-component { width: 200px;  }

}

</style>