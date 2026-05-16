<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppFrontoffice from './AppFrontoffice.vue';
import AppBackoffice from './AppBackoffice.vue';
import { isBackofficeRoute } from '@/utils/backStorage';

const route = useRoute();

const isBackoffice = computed(() => {
    return isBackofficeRoute(route.path);
});
</script>

<template>
    <AppBackoffice v-if="isBackoffice" />
    <AppFrontoffice v-else />
</template>
