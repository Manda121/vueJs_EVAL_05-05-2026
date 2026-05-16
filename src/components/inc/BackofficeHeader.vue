<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { getUserSession, removeUserSession } from '@/utils/backStorage';

const router = useRouter();
const user_session = ref(getUserSession());

const updateSession = () => {
    user_session.value = getUserSession();
};

let interval = null;

onMounted(() => {
    updateSession();
    interval = setInterval(updateSession, 500);
});

onUnmounted(() => {
    clearInterval(interval);
});

function disconnect() {
    removeUserSession();
    user_session.value = null;
    router.push('/login');
}
</script>

<template>
    <header class="bo-header">
        <p>
            <strong>Backoffice</strong>
            <RouterLink to="/customer">Clients</RouterLink>
            <RouterLink to="/back/commandes">Commandes</RouterLink>
            <RouterLink to="/reinitialisation">Reinitialisation</RouterLink>

            <template v-if="user_session">
                <span>{{ user_session.firstname }} {{ user_session.lastname }}</span>
                <button type="button" @click="disconnect">Deconnecter</button>
            </template>
        </p>
    </header>
</template>

<style scoped>
.bo-header {
    padding: 1rem;
    border-bottom: 1px solid #ccc;
    background: #f5f5f5;
}
.bo-header p {
    display: flex;
    gap: 15px;
    align-items: center;
    flex-wrap: wrap;
    margin: 0;
}
button {
    cursor: pointer;
}
</style>
