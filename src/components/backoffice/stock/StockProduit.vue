<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

// Déclaration des props pour recevoir l'ID du produit depuis un composant parent
const props = defineProps({
    productId: {
        type: [String, Number],
        required: true
    }
});

const loading = ref(false);
const error = ref(null);
const warning = ref(null);

const produit = ref(null);
const stocks = ref([]); // Stockera la liste des stocks (Simple ou Déclinaisons)

const parser = new XMLParser({});

// Configuration de l'API (identique à votre méthode)
const api = axios.create({
    baseURL: '/api',
    headers: {
        'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
    }
});

// Vos fonctions utilitaires pour sécuriser les tableaux
const normalizeToArray = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
};

// Fonction pour récupérer la quantité en stock via l'ID Stock Available
const getStockQuantity = async (idStockAvailable) => {
    if (!idStockAvailable) return 0;
    try {
        const res = await api.get(`/stock_availables/${idStockAvailable}`);
        const stockData = parser.parse(res.data)?.prestashop?.stock_available;
        return parseInt(stockData?.quantity || 0, 10);
    } catch (err) {
        console.error("Erreur récupération quantité stock:", err);
        return 0;
    }
};

// Fonction pour récupérer les attributs d'une déclinaison (ex: Taille - XL, Couleur - Rouge)
const getComboDetails = async (idProductAttribute) => {
    if (!idProductAttribute || idProductAttribute === "0") return [];

    try {
        const resCombo = await api.get(`/combinations/${idProductAttribute}`);
        const combo = parser.parse(resCombo.data)?.prestashop?.combination;

        const values = normalizeToArray(combo?.associations?.product_option_values?.product_option_value);
        let details = [];

        for (const v of values) {
            // 1. Valeur (ex: "Bleu")
            const resVal = await api.get(`/product_option_values/${v.id}`);
            const valData = parser.parse(resVal.data)?.prestashop?.product_option_value;
            const valName = Array.isArray(valData.name.language) ? valData.name.language[0] : valData.name.language;

            // 2. Option Parente (ex: "Couleur")
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

// Fonction principale de chargement des données
const fetchStockData = async () => {
    loading.value = true;
    error.value = null;
    warning.value = null;
    stocks.value = [];
    produit.value = null;

    try {
        // 1. Récupérer les informations de base du produit
        const resProd = await api.get(`/products/${props.productId}`, {
            params: { 'display': 'full' }
        });
        const prodData = parser.parse(resProd.data)?.prestashop?.product;

        if (!prodData) {
            warning.value = "Produit introuvable.";
            return;
        }

        produit.value = prodData;

        // 2. Vérifier si le produit a des déclinaisons
        const combinations = normalizeToArray(prodData?.associations?.combinations?.combination);

        if (combinations.length > 0) {
            // --- CAS PRODUIT AVEC DECLINAISONS ---
            for (const combo of combinations) {
                const idCombo = combo.id;

                // Trouver le stock associé à cette déclinaison spécifique
                // PrestaShop expose un filtre par id_product et id_product_attribute
                const resStockLink = await api.get('/stock_availables', {
                    params: {
                        'filter[id_product]': `[${props.productId}]`,
                        'filter[id_product_attribute]': `[${idCombo}]`,
                        'display': 'full'
                    }
                });

                const stockLinkRoot = parser.parse(resStockLink.data)?.prestashop?.stock_availables;
                const stockLink = normalizeToArray(stockLinkRoot?.stock_available)[0];

                const qty = await getStockQuantity(stockLink?.id);
                const attributes = await getComboDetails(idCombo);

                stocks.value.push({
                    id_product_attribute: idCombo,
                    details: attributes,
                    quantity: qty
                });
            }
        } else {
            // --- CAS PRODUIT SIMPLE (SANS DECLINAISON) ---
            // On cherche le stock où id_product_attribute vaut 0
            const resStockLink = await api.get('/stock_availables', {
                params: {
                    'filter[id_product]': `[${props.productId}]`,
                    'filter[id_product_attribute]': '[0]',
                    'display': 'full'
                }
            });

            const stockLinkRoot = parser.parse(resStockLink.data)?.prestashop?.stock_availables;
            const stockLink = normalizeToArray(stockLinkRoot?.stock_available)[0];

            const qty = await getStockQuantity(stockLink?.id);

            stocks.value.push({
                id_product_attribute: "0",
                details: [],
                quantity: qty
            });
        }

    } catch (err) {
        error.value = "Erreur lors de la récupération des informations de stock.";
        console.error("Détails stock:", err);
    } finally {
        loading.value = false;
    }
};

// Charger les données au montage du composant
onMounted(() => {
    if (props.productId) {
        fetchStockData();
    }
});
</script>

<template>
    <div class="stock-container">
        <div v-if="loading">Chargement des informations de stock...</div>
        <div v-if="error" class="error-msg">{{ error }}</div>
        <div v-if="warning" class="warning-msg">{{ warning }}</div>

        <div v-if="!loading && !error && produit">
            <h3>
                Stock pour : 
                {{ Array.isArray(produit.name?.language) ? produit.name.language[0] : produit.name?.language }}
            </h3>
            <p class="reference">Référence de base : {{ produit.reference }}</p>

            <table>
                <thead>
                    <tr>
                        <th>Déclinaison / Variante</th>
                        <th>Quantité disponible</th>
                        <th>Statut</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="stock in stocks" :key="stock.id_product_attribute">
                        <td>
                            <span v-if="stock.id_product_attribute === '0'">Produit Standard</span>
                            
                            <div v-else>
                                <small class="combo-id">ID Variante: {{ stock.id_product_attribute }}</small>
                                <div v-for="(item, index) in stock.details" :key="index">
                                    <strong>{{ item.option }} :</strong> {{ item.valeur }}
                                </div>
                            </div>
                        </td>
                        <td>
                            <strong>{{ stock.quantity }}</strong> unités
                        </td>
                        <td>
                            <span v-if="stock.quantity > 0" class="badge InStock">En Stock</span>
                            <span v-else class="badge OutOfStock">Rupture</span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<style scoped>
.stock-container {
    margin-top: 20px;
    padding: 15px;
    border: 1px solid #ddd;
    border-radius: 8px;
    background-color: #fff;
}
.reference {
    color: #666;
    font-style: italic;
    font-size: 0.9rem;
}
table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 15px;
}
th, td {
    border: 1px solid #eee;
    padding: 10px;
    text-align: left;
}
th {
    background-color: #f9f9f9;
}
.combo-id {
    color: #888;
    display: block;
}
.badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: bold;
}
.InStock {
    background-color: #e6f4ea;
    color: #137333;
}
.OutOfStock {
    background-color: #fce8e6;
    color: #c5221f;
}
.error-msg { color: red; }
.warning-msg { color: orange; }
</style>