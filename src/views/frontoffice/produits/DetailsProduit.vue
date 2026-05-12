<script setup>
import DetailsProduit from '../../../components/frontoffice/Produits/DetialsProduit.vue'
import { useRoute } from 'vue-router'
import { useRouter } from 'vue-router';

const router = useRouter();

const user_session = JSON.parse(localStorage.getItem('customer_session'));

if (!user_session) {
    router.push('/');
}

const route = useRoute();
const id_produit = route.params.id;

</script>

<template>
<DetailsProduit v-model="id_produit"/>
</template>