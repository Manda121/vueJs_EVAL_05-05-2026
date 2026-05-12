<script setup>
import ListePanier from '@/components/frontoffice/panier/ListePanier.vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const user_session = JSON.parse(localStorage.getItem('customer_session'));

if (!user_session) {
    router.push('/');
}
</script>

<template>
    <div>
        <h1>Liste des paniers</h1>
        <ListePanier />
    </div>
</template>