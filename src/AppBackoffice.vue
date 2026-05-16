<script setup>
import { computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BackofficeHeader from './components/inc/BackofficeHeader.vue';
import {
    getUserSession,
    isBackofficeLoginRoute,
    requiresBackofficeAuth
} from '@/utils/backStorage';

const route = useRoute();
const router = useRouter();

const showHeader = computed(() => {
    return !isBackofficeLoginRoute(route.path) && getUserSession();
});

const checkAuth = () => {
    if (!requiresBackofficeAuth(route.path)) return;
    if (!getUserSession()) {
        router.push('/login');
    }
};

onMounted(checkAuth);

watch(
    () => route.path,
    () => {
        checkAuth();
    }
);
</script>

<template>
    <BackofficeHeader v-if="showHeader" />
    <div id="app-backoffice">
        <router-view />
    </div>
</template>

<style>
#app-backoffice {
    font-family: sans-serif;
    padding: 20px;
}
</style>
