<script setup>
import Detailscustomer from '../../components/customers/Detailscustomer.vue';
import { useRoute } from 'vue-router'

const route = useRoute();
const id = route.params.id;
</script>

<template>
    <Detailscustomer :id_customer="id"/>
</template>