<script setup>
import Listecustomer from '../../components/customers/Listecustomer.vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const user_session = localStorage.getItem('user_session');

if (!user_session) {
    router.push('/login');
}
</script>

<template>
    <Listecustomer />
</template>