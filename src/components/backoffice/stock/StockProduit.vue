<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

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
const stocks = ref([]);

const parser = new XMLParser({});
const builder = new XMLBuilder({ format: true });

// Instance pour l'API PrestaShop Native (Lecture des données)
const api = axios.create({
    baseURL: '/api',
    headers: {
        'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
    }
});

// TOKEN généré depuis ta base de données pour ton module sur-mesure
const MODULE_TOKEN = '49d9540686722ab0727706178d87d787a30d1fac2dea22217bbb2293d3f35e6c';

const normalizeToArray = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
};

// Récupérer les détails complets d'un stock physique depuis l'API
const getStockDetails = async (idStockAvailable) => {
    if (!idStockAvailable) return null;
    try {
        const res = await api.get(`/stock_availables/${idStockAvailable}`);
        return parser.parse(res.data)?.prestashop?.stock_available;
    } catch (err) {
        console.error("Erreur récupération stock:", err);
        return null;
    }
};

// Récupérer les noms des attributs (Couleur, Taille...)
const getComboDetails = async (idProductAttribute) => {
    if (!idProductAttribute || idProductAttribute === "0") return [];
    try {
        const resCombo = await api.get(`/combinations/${idProductAttribute}`);
        const combo = parser.parse(resCombo.data)?.prestashop?.combination;
        const values = normalizeToArray(combo?.associations?.product_option_values?.product_option_value);
        let details = [];

        for (const v of values) {
            const resVal = await api.get(`/product_option_values/${v.id}`);
            const valData = parser.parse(resVal.data)?.prestashop?.product_option_value;
            const valName = Array.isArray(valData.name.language) ? valData.name.language[0] : valData.name.language;

            const idGroup = valData.id_attribute_group;
            const resOpt = await api.get(`/product_options/${idGroup}`);
            const optData = parser.parse(resOpt.data)?.prestashop?.product_option;
            const optName = Array.isArray(optData.name.language) ? optData.name.language[0] : optData.name.language;

            details.push({ option: optName, valeur: valName });
        }
        return details;
    } catch (err) {
        return [];
    }
};

// Fonction principale de chargement
const fetchStockData = async () => {
    loading.value = true;
    error.value = null;
    warning.value = null;
    stocks.value = [];
    produit.value = null;

    try {
        const resProd = await api.get(`/products/${props.productId}`, {
            params: { 'display': 'full' }
        });
        const prodData = parser.parse(resProd.data)?.prestashop?.product;

        if (!prodData) {
            warning.value = "Produit introuvable.";
            return;
        }

        produit.value = prodData;
        const combinations = normalizeToArray(prodData?.associations?.combinations?.combination);

        if (combinations.length > 0) {
            for (const combo of combinations) {
                const idCombo = combo.id;
                const resStockLink = await api.get('/stock_availables', {
                    params: {
                        'filter[id_product]': `[${props.productId}]`,
                        'filter[id_product_attribute]': `[${idCombo}]`,
                        'display': 'full'
                    }
                });

                const stockLinkRoot = parser.parse(resStockLink.data)?.prestashop?.stock_availables;
                const stockLink = normalizeToArray(stockLinkRoot?.stock_available)[0];

                const stockComplet = await getStockDetails(stockLink?.id);
                const attributes = await getComboDetails(idCombo);

                if (stockComplet) {
                    stocks.value.push({
                        id_stock_available: stockComplet.id,
                        id_product_attribute: idCombo,
                        details: attributes,
                        quantity: parseInt(stockComplet.quantity || 0, 10),
                        quantiteAAjouter: 0,
                        stockOriginal: stockComplet
                    });
                }
            }
        } else {
            const resStockLink = await api.get('/stock_availables', {
                params: {
                    'filter[id_product]': `[${props.productId}]`,
                    'filter[id_product_attribute]': '[0]',
                    'display': 'full'
                }
            });

            const stockLinkRoot = parser.parse(resStockLink.data)?.prestashop?.stock_availables;
            const stockLink = normalizeToArray(stockLinkRoot?.stock_available)[0];

            const stockComplet = await getStockDetails(stockLink?.id);

            if (stockComplet) {
                stocks.value.push({
                    id_stock_available: stockComplet.id,
                    id_product_attribute: "0",
                    details: [],
                    quantity: parseInt(stockComplet.quantity || 0, 10),
                    quantiteAAjouter: 0,
                    stockOriginal: stockComplet
                });
            }
        }

    } catch (err) {
        error.value = "Erreur lors de la récupération du stock.";
    } finally {
        loading.value = false;
    }
};

// Nouvelle fonction pour appliquer la variation via ton module stockadjuster
const appliquerAjustement = async (stockItem) => {
    // Si l'utilisateur clique sans rien écrire, on s'arrête
    if (stockItem.quantiteAAjouter === 0) {
        return;
    }

    const nouveauTotalAperçu = stockItem.quantity + stockItem.quantiteAAjouter;

    if (nouveauTotalAperçu < 0) {
        alert("Le stock final ne peut pas être négatif !");
        return;
    }

    try {
        // 1. On prépare la structure XML attendue par le parseur de ton module PHP
        const xmlPayloadObj = {
            stock_adjustment: {
                id_product: props.productId,
                id_product_attribute: stockItem.id_product_attribute,
                delta: stockItem.quantiteAAjouter, // Ici on passe la variation (+5, -2, etc.)
                id_shop: stockItem.stockOriginal.id_shop || 1,
                reason: 2 // Motif par défaut (Ex: Correction d'inventaire)
            }
        };

        // 2. Conversion de l'objet en chaîne de caractères XML
        const xmlData = builder.build(xmlPayloadObj);

        // 3. Appel de l'endpoint du module via ton Proxy
        // Grâce au proxy, l'appel cible l'adresse de ton contrôleur PHP
        const response = await axios.post(
            '/module/stockadjuster/adjust',
            xmlData,
            {
                headers: {
                    'Content-Type': 'application/xml; charset=utf-8',
                    'X-API-TOKEN': MODULE_TOKEN // Injection de ton token de base de données
                }
            }
        );

        // 4. Lecture de la réponse XML renvoyée par ton module
        const parsedResponse = parser.parse(response.data);
        const resultXml = parsedResponse?.prestashop?.stock_adjustment;

        // MODIFICATION ICI : On vérifie si c'est égal à true (booléen) OU à 'true' (chaîne)
        if (resultXml && (resultXml.success === true || resultXml.success === 'true')) {

            // On récupère la valeur mise à jour calculée et renvoyée par le serveur
            stockItem.quantity = parseInt(resultXml.quantity_after, 10);
            stockItem.quantiteAAjouter = 0; // Remise à zéro du champ input
            alert("Le stock a été ajusté et tracé avec succès !");

        } else {
            alert("Erreur lors de l'ajustement du stock.");
        }

    } catch (err) {
        console.error("Erreur module stockadjuster :", err);

        // Tentative de lecture de l'erreur au format XML si renvoyée par le serveur
        if (err.response && err.response.data) {
            try {
                const parsedErr = parser.parse(err.response.data);
                const errorMsg = parsedErr?.prestashop?.errors?.error?.message;
                if (errorMsg) {
                    alert(`Erreur : ${errorMsg}`);
                    return;
                }
            } catch (pErr) { }
        }
        alert("Impossible de modifier le stock via le module.");
    }
};

onMounted(() => {
    if (props.productId) {
        fetchStockData();
    }
});
</script>

<template>
    <div class="stock-container">
        <div v-if="loading">Chargement...</div>
        <div v-if="error" class="error-msg">{{ error }}</div>
        <div v-if="warning" class="warning-msg">{{ warning }}</div>

        <div v-if="!loading && !error && produit">
            <h3>
                {{ Array.isArray(produit.name?.language) ? produit.name.language[0] : produit.name?.language }}
            </h3>
            <p class="reference">Référence : {{ produit.reference }}</p>

            <table>
                <thead>
                    <tr>
                        <th>Variante</th>
                        <th>Stock Actuel</th>
                        <th>Quantité à ajouter / enlever</th>
                        <th>Aperçu final</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="stock in stocks" :key="stock.id_product_attribute">
                        <td>
                            <span v-if="stock.id_product_attribute === '0'">Produit Standard</span>
                            <div v-else>
                                <div v-for="(item, index) in stock.details" :key="index">
                                    <strong>{{ item.option }} :</strong> {{ item.valeur }}
                                </div>
                            </div>
                        </td>
                        <td>
                            <span :class="stock.quantity > 0 ? 'txt-vert' : 'txt-rouge'">
                                <strong>{{ stock.quantity }}</strong> unités
                            </span>
                        </td>
                        <td>
                            <input type="number" v-model.number="stock.quantiteAAjouter" class="input-stock"
                                placeholder="0" />
                        </td>
                        <td>
                            <span class="txt-bleu">
                                {{ stock.quantity + stock.quantiteAAjouter }} u.
                            </span>
                        </td>
                        <td>
                            <button type="button" @click="appliquerAjustement(stock)" class="btn-modifier">
                                Valider
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
