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

const orders = ref([]);

const parser = new XMLParser({});

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
    }
});

const isRunning = ref(false);

const DeleteCommande = async () => {
    loading.value = 'suppression en cours...';

    try {
        const response = await api.get('/orders', {
            params: { display: 'full' }
        });

        const jsonObj = parser.parse(response.data);
        const data = jsonObj?.prestashop?.orders?.order;

        if (!data) {
            warning.value = 'Aucune commande trouvee.';
            return;
        }

        const listeCommandes = Array.isArray(data) ? data : [data];
        orders.value = listeCommandes;

        for (let i = 0; i < orders.value.length; i++) {
            loading.value = `Suppression de la commande ${orders.value[i].id}...`;
            error.value = null;
            try {
                await api.delete('/orders/' + orders.value[i].id, {
                    params: { display: 'full' }
                });
            } catch (errDelete) {
                error.value = `Erreur lors de la suppression de la commande ${orders.value[i].id}. cause: ${errDelete}`;
            }
        }
    } catch (err) {
        error.value = 'Erreur lors de la recuperation ou du traitement des donnees. ' + err;
        console.error('Details:', err);
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
        await DeleteCommande();
    } finally {
        isRunning.value = false;
        emit('done');
    }
});
</script>

<template>
    <div>
        <h2>Commande</h2>
        <button v-if="props.showButton" @click="DeleteCommande">delete</button>
        <Loading v-if="loading" message="Chargement des commandes..." />
        <Error :error="error" v-if="error" />
        <Warning :warning="warning" v-if="warning" />
    </div>
</template>
