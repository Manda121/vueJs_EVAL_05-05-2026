<script setup>
import DetailsProduit from '../../../components/frontoffice/Produits/DetialsProduit.vue'
import { useRoute } from 'vue-router'

const route = useRoute();
const id_produit = route.params.id;

</script>

<template>
<DetailsProduit v-model="id_produit"/>
</template>