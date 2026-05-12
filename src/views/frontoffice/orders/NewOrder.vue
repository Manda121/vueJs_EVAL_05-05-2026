<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import Loading from '@/components/inc/Loading.vue';
import Warning from '@/components/inc/Warning.vue';
import Error from '@/components/inc/Error.vue';
import Addresse from '../addresse/addresse.vue';

const loading = ref(false);
const warning = ref(null);
const error = ref(null);

const etape = ref(0);

customer_session = JSON.parse(localStorage.getItem('customer_session'));
panier_session = JSON.parse(localStorage.getItem('panier_session'));

customer = ref();
addresse = ref();
mode_livraison = ref();

if(customer_session == null || panier_session == null){
    warning.value = "Vous devez être connecté et avoir des produits dans votre panier pour passer une commande.";
    etape.value = 1;
}  else { customer =  }

if(!customer_session.addresse){
    warning.value = "Vous devez ajouter une adresse de livraison pour passer une commande.";
    etape.value = 2;
} else { addresse }

// choix mode livraison (api)

// choix mode paiement

</script>

<template>

</template>