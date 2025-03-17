<template>
    <div>
        <div v-if="props.isBasicView" class="nav-user-wrapper flex align-items-center gap-2 bg-gray-100">
            <div class="flex gap-2 align-items-center justify-content-center">
                <PvButton
                    text
                    data-cy="button-sign-out"
                    class="no-underline h-2 p-1 m-0 text-primary border-none border-round h-2rem text-sm hover:bg-red-900 hover:text-white"
                    @click="signOut">
                    {{ $t('navBar.signOut') }}
                </PvButton>
            </div>

        </div>
        <div v-else class="flex gap-2">
            <!-- Help dropdown -->
            <PvDropdown :options="helpOptions" :optionValue="(o) => o.value" :optionLabel="(o) => o.label"  @change="handleHelpChange">
                <template #value>
                    <i class="pi pi-question-circle"></i>
                </template>
            </PvDropdown>
            <button ref="feedbackButton" style="display: none">Give me feedback</button>


            <!-- Profile dropdown -->
            <PvDropdown :options="profileOptions" :optionValue="(o) => o.value" :optionLabel="(o) => o.label"  @change="handleProfileChange">
                <template #value>
                    <i class="pi pi-user"></i>
                </template>
            </PvDropdown>
        </div>
    </div>
</template>

<script setup>
    import {ref} from 'vue';
    import useSignOutMutation from '@/composables/mutations/useSignOutMutation';
    import PvButton from 'primevue/button';
    import PvDropdown from 'primevue/dropdown';
    import { useRouter } from 'vue-router';
    import { useI18n } from 'vue-i18n';
    import { APP_ROUTES } from '@/constants/routes';


    const i18n = useI18n();
    const router = useRouter();
    const { mutate: signOut } = useSignOutMutation();

    const feedbackButton = ref(null);

    const props = defineProps({
        isBasicView: {type: Boolean, required: true},
        name: {type: String, required: true},
    })


    // BACKED OUT: getting access to feedback button
    // onMounted(() => {
    //     // Depreacted in latest version of Sentry and replaced with getFeedback()
    //     const feedbackInstance = Sentry.getClient()?.getIntegration(Sentry.Feedback);

    //     if (feedbackInstance && feedbackButton.value) {
    //         feedbackInstance.attachTo(feedbackButton.value);
    //     }
    // });



    // BACKED OUT: update styling of feedback modal based on view type to center
    // watchEffect(() => {
    //     const feedbackElement = document.getElementById('sentry-feedback');
    //     if (feedbackElement) {
    //         if (!props.isBasicView) {
    //             feedbackElement.style.setProperty('--bottom', '28%');
    //             feedbackElement.style.setProperty('--left', '40%');
    //         }
    //     }
    // });


    const helpOptions = [
        { label: 'Researcher Documentation', value: 'researcherDocumentation' },
        // BACKED OUT: Nav Bar Report an Issue
        // { label: 'Report an Issue', value: 'reportAnIssue' }
    ];

    const profileOptions = [
        {label: "Settings", value: 'settings'},
        {label: i18n.t('navBar.signOut'), value: 'signout'}
    ]

    const handleHelpChange = (e) => {
        if (e.value === 'researcherDocumentation') {
            window.open('https://levante-researcher.super.site/', '_blank');
        } else if (e.value === 'reportAnIssue') {
            // BACKED OUT: opens feedback modal
            // feedbackButton.value.click();
        }
    };

    const handleProfileChange = (e) => {
        if (e.value === 'settings') {
            router.push({ path: APP_ROUTES.ACCOUNT_PROFILE });
        } else if (e.value === 'signout') {
            signOut();
        }
    };

</script>

<style>
    .nav-user-wrapper {
    display: flex;
    align-items: center;
    outline: 1.2px solid rgba(0, 0, 0, 0.1);
    border-radius: 0.3rem;
    padding: 0.5rem 0.8rem;
    }
</style>