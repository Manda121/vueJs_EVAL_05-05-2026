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
                        quantiteAAjouter: 0, // Nouveau champ : commence à 0 pour l'utilisateur
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
                    quantiteAAjouter: 0, // Nouveau champ : commence à 0 pour l'utilisateur
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

// Fonction pour appliquer l'augmentation ou la diminution
const appliquerAjustement = async (stockItem) => {
    // 1. On calcule le nouveau total absolu (Exemple: 10 actuel + 2 écrit dans le champ = 12)
    const nouveauTotal = stockItem.quantity + stockItem.quantiteAAjouter;

    // Sécurité élémentaire : on évite de tomber sous 0 unité en stock
    if (nouveauTotal < 0) {
        alert("Le stock final ne peut pas être négatif !");
        return;
    }

    try {
        // 2. Préparation du modèle XML avec le nouveau total calculé
        const stockModifier = {
            prestashop: {
                stock_available: {
                    id: stockItem.id_stock_available,
                    id_product: props.productId,
                    id_product_attribute: stockItem.id_product_attribute,
                    id_shop: stockItem.stockOriginal.id_shop,
                    id_shop_group: stockItem.stockOriginal.id_shop_group || 0,
                    quantity: nouveauTotal, // On envoie le résultat final
                    depends_on_stock: stockItem.stockOriginal.depends_on_stock,
                    out_of_stock: stockItem.stockOriginal.out_of_stock
                }
            }
        };

        // 3. Transformation en texte XML
        const xmlData = builder.build(stockModifier);

        // 4. Envoi de la mise à jour à PrestaShop via PUT
        await api.put(`/stock_availables/${stockItem.id_stock_available}`, xmlData, {
            headers: { 'Content-Type': 'application/xml' }
        });

        // 5. Mise à jour de l'affichage local si l'API a accepté le changement
        stockItem.quantity = nouveauTotal;
        stockItem.quantiteAAjouter = 0; // On remet le champ de saisie à 0 après validation
        alert("Stock mis à jour avec succès !");

    } catch (err) {
        console.error("Erreur lors de la modification du stock :", err);
        alert("Impossible de modifier le stock via l'API.");
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
                            <input 
                                type="number" 
                                v-model.number="stock.quantiteAAjouter" 
                                class="input-stock"
                                placeholder="0"
                            />
                        </td>
                        <td>
                            <span class="txt-bleu">
                                {{ stock.quantity + stock.quantiteAAjouter }} u.
                            </span>
                        </td>
                        <td>
                            <button 
                                type="button" 
                                @click="appliquerAjustement(stock)"
                                class="btn-modifier"
                            >
                                Valider
                            </button>
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
.input-stock {
    width: 80px;
    padding: 5px;
    border: 1px solid #ccc;
    border-radius: 4px;
    text-align: center;
}
.btn-modifier {
    background-color: #2196f3;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
}
.btn-modifier:hover {
    background-color: #0b7dda;
}
.txt-vert { color: #137333; }
.txt-rouge { color: #c5221f; }
.txt-bleu { color: #0288d1; font-weight: bold; }
.error-msg { color: red; }
.warning-msg { color: orange; }
</style>