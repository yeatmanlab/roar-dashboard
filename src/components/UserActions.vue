<template>
    <div>
        <div v-if="userType === AUTH_USER_TYPE.STUDENT" class="nav-user-wrapper flex align-items-center gap-2 bg-gray-100">
            <div class="flex gap-2 align-items-center justify-content-center mr-3">
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

            <!-- Profile dropdown -->
            <PvDropdown :options="filteredProfileOptions" :optionValue="(o) => o.value" :optionLabel="(o) => o.label"  @change="handleProfileChange">
                <template #value>
                    <i class="pi pi-user"></i>
                </template>
            </PvDropdown>
        </div>
    </div>
</template>

<script setup>
    import { computed } from 'vue';
    import useSignOutMutation from '@/composables/mutations/useSignOutMutation';
    import PvButton from 'primevue/button';
    import PvDropdown from 'primevue/dropdown';
    import * as Sentry from '@sentry/vue';
    import { useRouter } from 'vue-router';
    import { useI18n } from 'vue-i18n';
    import { APP_ROUTES } from '@/constants/routes';
    import { AUTH_USER_TYPE } from '../constants/auth';


    const i18n = useI18n();
    const router = useRouter();
    const { mutate: signOut } = useSignOutMutation();

    const props = defineProps({
        userType: {type: String, required: true},
        name: {type: String, required: true},
        isAdmin: {type: Boolean, required: true},
        isSuperAdmin: {type: Boolean, required: true}
    })

    const helpOptions = [
        { label: 'Researcher Documentation', value: 'researcherDocumentation' },
        { label: 'Report an Issue', value: 'reportAnIssue' }
    ];

    const profileOptions = [
        {label: "Your Settings", value: 'settings', adminsOnly: true},
        {label: i18n.t('navBar.signOut'), value: 'signout', adminsOnly: false}
    ]

    const filteredProfileOptions = computed(() => {
        return profileOptions.filter(option => !option.adminsOnly || (props.isAdmin || props.isSuperAdmin));
    });

    const handleHelpChange = (e) => {
        if (e.value === 'researcherDocumentation') {
            window.open('https://watery-wrench-dee.notion.site/', '_blank');
        } else if (e.value === 'reportAnIssue') {
            const eventId = Sentry.captureException(new Error('Dummy error to trigger Sentry dialog'));
            Sentry.showReportDialog({ eventId });      
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