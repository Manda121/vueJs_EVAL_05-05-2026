<script setup>
import { ref } from 'vue';
import { XMLParser } from 'fast-xml-parser';
import Loading from '@/components/inc/Loading.vue';
import Warning from '@/components/inc/Warning.vue';
import Error from '@/components/inc/Error.vue';
import axios from 'axios';

import { onMounted } from 'vue';

const addresses = ref([]);
const loading = ref(true);
const warning = ref(null);
const error = ref(null);

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
        const data = jsonObj?.prestashop?.addresses?.addresse;

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
    <div>
        <Loading v-if="loading" message="Chargement des addresses..." />
        <Warning :warning="warning" v-if="warning" />
        <Error :error="error" v-if="error" />
        <table>
            <tr>
                <th>id</th>
            </tr>
            <tr v-for="addresse in addresses">
                <td>
                </td>
                <td>{{ addresse.name.language[0] }} <br> {{ addresse.name.language[1] }}</td>
                <td>
                    <div v-if="addresse.associations?.specific_prices">
                        <span style="text-decoration: line-through; color: red; margin-right: 10px;">
                            {{ parseFloat(addresse.price).toFixed(2) }} €
                        </span>
                        <span style="font-weight: bold; color: green;">
                            PROMO (Consulter détail)
                        </span>
                    </div>
                    <div v-else>
                        {{ parseFloat(addresse.price).toFixed(2) }} €
                    </div>
                </td>
            </tr>
        </table>
    </div>
</template>

<style scoped>
img {
    width: 5%;
}
</style>