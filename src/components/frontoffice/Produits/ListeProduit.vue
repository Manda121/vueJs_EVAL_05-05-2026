<script setup>
import { ref } from 'vue';
import { XMLParser } from 'fast-xml-parser';
import Loading from '@/components/inc/Loading.vue';
import Warning from '@/components/inc/Warning.vue';
import Error from '@/components/inc/Error.vue';
import axios from 'axios';

import { onMounted } from 'vue';

const produits = ref([]);
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

const parseNumber = (value) => {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const roundPrice = (value) => {
    return Math.round(parseNumber(value));
};


const fetchProducts = async () => {
    loading.value = true;
    error.value = null;

    try {
        const response = await api.get('/products', {
            params: { 'display': 'full' }
        });

        const jsonObj = parser.parse(response.data);
        const data = jsonObj?.prestashop?.products?.product;

        if (!data) {
            warning.value = "Aucun produit trouvé.";
            return;
        }

        // On force le format tableau
        const listeproduits = Array.isArray(data) ? data : [data];
        produits.value = listeproduits;

        produits.value.sort((a, b) => a.id - b.id);

    } catch (err) {
        error.value = "Erreur lors de la récupération ou du traitement des données.";
        console.error("Détails:", err);
    } finally {
        loading.value = false;
    }
};

onMounted(fetchProducts);

</script>

<template>
    <div>
        <Loading v-if="loading" message="Chargement des produits..." />
        <Warning :warning="warning" v-if="warning" />
        <Error :error="error" v-if="error" />
        <table>
            <tr>
                <th>image</th>
                <th>produit</th>
                <th>prix</th>
            </tr>
            <tr v-for="produit in produits">
                <td>
                    <a :href="'/front/produits/' + produit.id">
                        <img :src="`http://localhost/prestashop_edition_classic_version_8.2.6/api/images/products/${produit.id}/${produit.id_default_image}?ws_key=4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB`"
                            :alt="`image de ${produit.name.language[0]}`">
                    </a>
                </td>
                <td><strong>{{ produit.id }}</strong></td>
                <td>{{ produit.name.language[0] }} <br> {{ produit.name.language[1] }}</td>
                <td>
                    <div v-if="produit.associations?.specific_prices">
                        <span style="text-decoration: line-through; color: red; margin-right: 10px;">
                            {{ roundPrice(produit.price).toFixed(2) }} €
                        </span>
                        <span style="font-weight: bold; color: green;">
                            PROMO (Consulter détail)
                        </span>
                    </div>
                    <div v-else>
                        {{ roundPrice(produit.price).toFixed(2) }} €
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