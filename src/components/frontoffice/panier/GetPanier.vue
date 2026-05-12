<script setup>
import { ref, onMounted } from 'vue';
import Loading from '@/components/inc/Loading.vue';
import Warning from '@/components/inc/Warning.vue';
import Error from '@/components/inc/Error.vue';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

const customer_session = JSON.parse(localStorage.getItem('customer_session'));
const panier_session = ref(JSON.parse(localStorage.getItem('cart_session')));

const loading = ref(false);
const error = ref(null);
const warning = ref(null);

const panier = ref();
const produits = ref([]);

const parser = new XMLParser({});

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
    }
});


const normalizeToArray = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
};

const fetchPanier = async () => {
    loading.value = true;
    error.value = null;
    warning.value = null;
    produits.value = [];

    try {
        if (!panier_session.value?.idCart) {
            warning.value = 'Aucun panier.';
            return;
        }

        let response = await api.get('/carts/' + panier_session.value.idCart, {
            params: { 'display': 'full' }
        });

        let jsonObj = parser.parse(response.data);

        let data = jsonObj?.prestashop?.cart;

        if (!data) {
            warning.value = 'Aucun panier.';
            return;
        }

        panier.value = data;
        const rows = normalizeToArray(panier.value?.associations?.cart_rows?.cart_row);

        for (const row of rows) {
            response = await api.get('/products/' + row.id_product, {
                params: { 'display': 'full' }
            });

            jsonObj = parser.parse(response.data);
            data = jsonObj?.prestashop?.product;

            if (data) {
                produits.value.push({
                    ...data,
                    quantity: Number(row.quantity || 0),
                    id_product_attribute: row.id_product_attribute
                });
            }
        }

    } catch (err) {
        error.value = 'Erreur lors de la recuperation ou du traitement des donnees.';
        console.error('Details:', err);
    } finally {
        loading.value = false;
    }
};

onMounted(fetchPanier);
</script>

<template>
    <div>
        <h2>Mon Panier {{ panier_session.idCart }}</h2>
        <Loading v-if="loading" message="Chargement du panier..." />
        <Warning v-if="warning" :warning="warning" />
        <Error v-if="error" :error="error" />

        <table v-if="!loading && !error && produits.length">
            <thead>
                <tr>
                    <th>Produit</th>
                    <th>Prix</th>
                    <th>Quantite</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="produit in produits" :key="produit.id">
                    <td>
                        {{ Array.isArray(produit.name?.language) ? produit.name.language[0] : produit.name?.language || produit.name }}
                    </td>
                    <td>{{ produit.price }}</td>
                    <td>{{ produit.quantity }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>