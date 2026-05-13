<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import Loading from '@/components/inc/Loading.vue';
import Warning from '@/components/inc/Warning.vue';
import Error from '@/components/inc/Error.vue';
import LoginSelect from '@/components/frontoffice/login/LoginSelect.vue'

const customers = ref([]);
const loading = ref(true);
const warning = ref(null);
const error = ref(null);

// Configuration du parseur
const parser = new XMLParser({
    ignoreAttributes: false, // Garder les attributs si besoin (ex: id)
    attributeNamePrefix: "", // Ne pas ajouter de préfixe aux attributs
    parseTagValue: true,     // Convertit "1" en nombre 1 ou "true" en booléen
    trimValues: true         // Nettoie les espaces blancs automatiquement
});

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
    }
});

const fetchCustomers = async () => {
    loading.value = true;
    error.value = null;

    try {
        const response = await api.get('/customers', {
            params: { 'display': 'full' }
        });

        const jsonObj = parser.parse(response.data);
        const data = jsonObj?.prestashop?.customers?.customer;

        if (!data) {
            warning.value = "Aucun client trouvé.";
            return;
        }

        // On force le format tableau
        const listeClients = Array.isArray(data) ? data : [data];
        customers.value = listeClients;

    } catch (err) {
        error.value = "Erreur lors de la récupération ou du traitement des données.";
        console.error("Détails:", err);
    } finally {
        loading.value = false;
    }
};

onMounted(fetchCustomers);
</script>

<template>
    <div>
        <Loading v-if="loading" message="Chargement des clients..." />
        <Warning :warning="warning" v-if="warning" />
        <Error :error="error" v-if="error" />

        <LoginSelect
            v-for="customer in customers"
            :key="customer.id"
            :email="customer.email"
            :password="customer.passwd"
        />
        <LoginSelect />
    </div>
</template>