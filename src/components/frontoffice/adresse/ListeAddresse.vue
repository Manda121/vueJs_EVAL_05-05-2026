<script setup>
import { ref } from 'vue';
import { XMLParser } from 'fast-xml-parser';
import Loading from '@/components/inc/Loading.vue';
import Warning from '@/components/inc/Warning.vue';
import Error from '@/components/inc/Error.vue';
import axios from 'axios';

import DetailAddresse from './DetailAddresse.vue';
import NewAddresse from './NewAddresse.vue';
import UpdateAddresse from './UpdateAddresse.vue';

import { onMounted } from 'vue';

const addresses = ref([]);
const loading = ref(true);
const warning = ref(null);
const error = ref(null);

const addresse_id = ref(null);
const addresse_id_upd = ref(null);
const create_addresse = ref(false);

const parser = new XMLParser({});

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
    }
});


const fetchaddresses = async () => {
    loading.value = true;
    error.value = null;

    try {
        const response = await api.get('/addresses', {
            params: { 'display': 'full' }
        });

        const jsonObj = parser.parse(response.data);
        const data = jsonObj?.prestashop?.addresses?.address;

        if (!data) {
            warning.value = "Aucun addresse trouvé.";
            return;
        }

        // On force le format tableau
        const listeaddresses = Array.isArray(data) ? data : [data];
        addresses.value = listeaddresses;

    } catch (err) {
        error.value = "Erreur lors de la récupération ou du traitement des données.";
        console.error("Détails:", err);
    } finally {
        loading.value = false;
    }
};

onMounted(fetchaddresses);

</script>

<template>
    <div :class="addresse_id || create_addresse || addresse_id_upd ? 'flou' : ''">
        <h2>Liste des adresses</h2>

        <button @click="create_addresse = true">Ajouter une adresse</button>

        <Loading v-if="loading" message="Chargement des addresses..." />
        <Warning :warning="warning" v-if="warning" />
        <Error :error="error" v-if="error" />

        <table v-else border="1">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Alias</th>
                    <th>Nom</th>
                    <th>Adresse</th>
                    <th>Ville</th>
                    <th>Pays</th>
                    <th>Telephone</th>
                    <th>Ajout</th>
                    <th>Modifier</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="addresse in addresses" :key="addresse.id" style="cursor: grab;">
                    <td @click="addresse_id = addresse.id">{{ addresse.id }}</td>
                    <td @click="addresse_id = addresse.id">{{ addresse.alias }}</td>
                    <td @click="addresse_id = addresse.id">{{ addresse.firstname }} {{ addresse.lastname }}</td>
                    <td @click="addresse_id = addresse.id">{{ addresse.address1 }}</td>
                    <td @click="addresse_id = addresse.id">{{ addresse.city }}</td>
                    <td @click="addresse_id = addresse.id">{{ addresse.id_country }}</td>
                    <td @click="addresse_id = addresse.id">{{ addresse.phone }}</td>
                    <td @click="addresse_id = addresse.id">{{ addresse.date_add }}</td>
                    <td><button @click="addresse_id_upd = addresse.id">Modifier</button></td>
                </tr>
            </tbody>
        </table>
    </div>
    <DetailAddresse v-if="addresse_id" v-model="addresse_id" />
    <UpdateAddresse v-if="addresse_id_upd" v-model="addresse_id_upd" />
    <NewAddresse v-if="create_addresse" v-model="create_addresse" />
</template>