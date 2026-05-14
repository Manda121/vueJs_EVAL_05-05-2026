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

const carts = ref([]);

const parser = new XMLParser({});

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
    }
});

const isRunning = ref(false);

const DeletePanier = async () => {
    loading.value = 'suppression en cours...';

    try {
        const response = await api.get('/carts', {
            params: { display: 'full' }
        });

        const jsonObj = parser.parse(response.data);
        const data = jsonObj?.prestashop?.carts?.cart;

        if (!data) {
            warning.value = 'Aucun panier trouve.';
            return;
        }

        const listePaniers = Array.isArray(data) ? data : [data];
        carts.value = listePaniers;

        for (let i = 0; i < carts.value.length; i++) {
            loading.value = `Suppression du panier ${carts.value[i].id}...`;
            error.value = null;
            try {
                await api.delete('/carts/' + carts.value[i].id, {
                    params: { display: 'full' }
                });
            } catch (errDelete) {
                error.value = `Erreur lors de la suppression du panier ${carts.value[i].id}. cause: ${errDelete}`;
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
        await DeletePanier();
    } finally {
        isRunning.value = false;
        emit('done');
    }
});
</script>

<template>
    <div>
        <h2>Panier</h2>
        <button v-if="props.showButton" @click="DeletePanier">delete</button>
        <Loading v-if="loading" message="Chargement des paniers..." />
        <Error :error="error" v-if="error" />
        <Warning :warning="warning" v-if="warning" />
    </div>
</template>
