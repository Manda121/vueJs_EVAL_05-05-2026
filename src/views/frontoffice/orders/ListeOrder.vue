<script setup>
import ListeOrder from '@/components/frontoffice/orders/ListeOrders.vue';
import Login from '@/views/frontoffice/login/Login.vue';
import { useRouter } from 'vue-router';
import { ref } from 'vue';

const router = useRouter();
const logged = ref(false);

const user_session = JSON.parse(localStorage.getItem('customer_session'));

if (!user_session) {
    logged.value = true;
}
</script>

<template>
    <a href="/front/login" v-if="!logged">se connecter</a>
    <a href="/front/commandes/new">commander</a>
    <ListeOrder />
</template>