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
            // 1. Récupérer les infos du produit de base
            let resProd = await api.get('/products/' + row.id_product, {
                params: { 'display': 'full' }
            });
            let prodData = parser.parse(resProd.data)?.prestashop?.product;

            let comboDetails = null;
            let priceImpact = 0;

            // 2. Si le produit a une combinaison, on récupère son impact
            if (row.id_product_attribute && row.id_product_attribute !== "0") {
                try {
                    let resCombo = await api.get('/combinations/' + row.id_product_attribute);
                    let comboData = parser.parse(resCombo.data)?.prestashop?.combination;

                    if (comboData) {
                        priceImpact = parseFloat(comboData.price || 0);
                        // On peut aussi stocker l'ID de la combinaison pour plus tard
                        comboDetails = row.id_product_attribute;
                    }
                } catch (cErr) {
                    console.error("Erreur combo:", cErr);
                }
            }

            if (prodData) {
                produits.value.push({
                    ...prodData,
                    details: await getComboDetails(comboDetails), // Récupère les détails de la combinaison
                    quantity: Number(row.quantity || 0),
                    id_product_attribute: row.id_product_attribute,
                    price_impact: priceImpact, // On stocke l'impact
                    total_unit_price: parseFloat(prodData.price) + priceImpact // Calcul du prix réel
                });
                console.log(produits.value[0].details);
            }
        }

    } catch (err) {
        error.value = 'Erreur lors de la recuperation ou du traitement des donnees.';
        console.error('Details:', err);
    } finally {
        loading.value = false;
    }
};

const getComboDetails = async (id_product_attribute) => {
    if (!id_product_attribute || id_product_attribute === "0") return [];

    try {
        const resCombo = await api.get(`/combinations/${id_product_attribute}`);
        const combo = parser.parse(resCombo.data)?.prestashop?.combination;

        const values = normalizeToArray(combo?.associations?.product_option_values?.product_option_value);

        let details = []; // Initialisation indispensable

        for (const v of values) {
            // 1. Récupérer la valeur (ex: "Bleu")
            const resVal = await api.get(`/product_option_values/${v.id}`);
            const valData = parser.parse(resVal.data)?.prestashop?.product_option_value;
            const valName = Array.isArray(valData.name.language) ? valData.name.language[0] : valData.name.language;

            // 2. Récupérer l'option parente (ex: "Couleur")
            // On utilise l'id_attribute_group qui lie la valeur à son groupe (option)
            const idGroup = valData.id_attribute_group;
            const resOpt = await api.get(`/product_options/${idGroup}`);
            const optData = parser.parse(resOpt.data)?.prestashop?.product_option;
            const optName = Array.isArray(optData.name.language) ? optData.name.language[0] : optData.name.language;

            details.push({
                option: optName,
                valeur: valName
            });
        }
        return details;
    } catch (err) {
        console.error("Erreur détails combo:", err);
        return [];
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
                <tr v-for="produit in produits" :key="produit.id + '-' + produit.id_product_attribute">
                    <td>
                        <div class="product-name">
                            {{ Array.isArray(produit.name?.language) ? produit.name.language[0] : produit.name?.language
                            }}
                        </div>

                        <small v-if="produit.id_product_attribute != 0" class="combo-info">
                            Variante ID: {{ produit.id_product_attribute }}
                        </small>
                        <div v-for="(item, index) in produit.details" :key="index">
                            <strong>{{ item.option }} :</strong> {{ item.valeur }}
                        </div>
                    </td>
                    <td>
                        <div class="price-details">
                            <span class="final-price">{{ produit.total_unit_price.toFixed(2) }} €</span>

                            <div v-if="produit.price_impact !== 0" class="impact-tag">
                                <small>
                                    (Base: {{ parseFloat(produit.price).toFixed(2) }}
                                    {{ produit.price_impact > 0 ? '+' : '' }}{{ produit.price_impact.toFixed(2) }}
                                    impact)
                                </small>
                            </div>
                        </div>
                    </td>
                    <td>{{ produit.quantity }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>