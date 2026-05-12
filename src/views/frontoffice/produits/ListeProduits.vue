<script setup>
import ListeProduit from '@/components/frontoffice/Produits/ListeProduit.vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const user_session = JSON.parse(localStorage.getItem('customer_session'));

if (!user_session) {
    router.push('/');
}
</script>

<template>
    <div>
        <ListeProduit/>
    </div>
</template>