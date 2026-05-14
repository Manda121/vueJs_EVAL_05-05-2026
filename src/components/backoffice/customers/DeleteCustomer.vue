
<script setup>
import { XMLParser } from 'fast-xml-parser';
import { ref, watch } from 'vue';
import axios from 'axios';
import Loading from '../../inc/Loading.vue';
import Error from '../../inc/Error.vue';
import Warning from '../../inc/Warning.vue';

const runSignal = defineModel('runSignal');
const props = defineProps({
    showButton: { type: Boolean, default: false }
});
const emit = defineEmits(['done']);

const loading = ref(null);
const error = ref(null);
const warning = ref(null);

const customers = ref([]);

const parser = new XMLParser({});

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
    }
});

const isRunning = ref(false);

const DeleteCustomer = async () => {
    loading.value = "suppression en cours...";

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

        // Boucle sur chaque client pour calculer ses ventes
        for (let i = 0; i < customers.value.length; i++) {
            loading.value = `Suppression du client ${customers.value[i].id}...`;
            error.value = null;
            try {
                await api.delete('/customers/' + customers.value[i].id, {
                    params: { 'display': 'full' }
                });
            } catch (errOrder) {
                error.value = `Erreur lors de la suppression du client ${customers.value[i].id}. cause: ${errOrder}`;
            }
        }

    } catch (err) {
        error.value = "Erreur lors de la récupération ou du traitement des données. " + err;
        console.error("Détails:", err);
    } finally {
        loading.value = false;
    }
};

watch(runSignal, async (newValue, oldValue) => {
    if (newValue === oldValue) return;
    if (!newValue) return;
    if (isRunning.value) return;

    isRunning.value = true;
    try {
        await DeleteCustomer();
    } finally {
        isRunning.value = false;
        emit('done');
    }
});
</script>

<template>
    <div>
        <h2>Customer</h2>
        <button v-if="props.showButton" @click="DeleteCustomer">delete</button>
        <Loading v-if="loading" message="Chargement des clients..." />
        <Error :error="error" v-if="error" />
        <Warning :warning="warning" v-if="warning" />
    </div>
</template>