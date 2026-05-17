<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

const loading = ref(false);
const error = ref(null);
const warning = ref(null);

const tousLesMouvements = ref([]); // Stocke TOUS les mouvements récupérés via l'API
const mouvementsFiltrés = ref([]);  // Contient uniquement les mouvements qui correspondent aux filtres appliqués

// États pour les filtres
const filterType = ref('all'); // 'all', 'day', 'range'
const filterDay = ref('');     // Pour le filtre par jour unique
const filterMin = ref('');     // Pour le filtre date min
const filterMax = ref('');     // Pour le filtre date max

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

// Caches locaux pour optimiser les requêtes API répétitives
const stockAvailableCache = new Map();
const productCache = new Map();
const combinationCache = new Map();

// Fonction pour récupérer les infos du produit via le stock_available
const getProductDetailsFromStockAvailable = async (idStock) => {
    if (!idStock) return null;

    try {
        let stockData = stockAvailableCache.get(idStock);
        if (!stockData) {
            const resStock = await api.get(`/stock_availables/${idStock}`);
            stockData = parser.parse(resStock.data)?.prestashop?.stock_available;
            if (stockData) {
                stockAvailableCache.set(idStock, stockData);
            }
        }

        if (!stockData) return null;

        const idProduct = stockData.id_product;
        const idCombination = parseInt(stockData.id_product_attribute || 0, 10);

        let productName = productCache.get(idProduct);
        if (!productName) {
            const resProd = await api.get(`/products/${idProduct}`);
            const prodData = parser.parse(resProd.data)?.prestashop?.product;
            productName = Array.isArray(prodData?.name?.language) ? prodData.name.language[0] : prodData?.name?.language;
            if (productName) productCache.set(idProduct, productName);
        }

        let attributesLang = null;
        if (idCombination > 0) {
            attributesLang = combinationCache.get(idCombination);
            if (!attributesLang) {
                const resComb = await api.get(`/combinations/${idCombination}`);
                const combData = parser.parse(resComb.data)?.prestashop?.combination;
                
                const associations = normalizeToArray(combData?.associations?.product_option_values?.product_option_value);
                if (associations.length > 0) {
                    let attrNames = [];
                    for (const assoc of associations) {
                        const resOptVal = await api.get(`/product_option_values/${assoc.id}`);
                        const optValData = parser.parse(resOptVal.data)?.prestashop?.product_option_value;
                        const optValName = Array.isArray(optValData?.name?.language) ? optValData.name.language[0] : optValData?.name?.language;
                        if (optValName) attrNames.push(optValName);
                    }
                    attributesLang = attrNames.join(', ');
                    combinationCache.set(idCombination, attributesLang);
                }
            }
        }

        return {
            id_product: idProduct,
            name: productName || `Produit #${idProduct}`,
            attributes: attributesLang
        };

    } catch (err) {
        return null;
    }
};

// Fonction pour récupérer initialement TOUS les mouvements depuis l'API
const fetchMouvements = async () => {
    loading.value = true;
    error.value = null;
    warning.value = null;
    tousLesMouvements.value = [];
    mouvementsFiltrés.value = [];

    try {
        const response = await api.get('/stock_movements', {
            params: {
                'display': 'full',
                'sort': '[id_DESC]'
            }
        });

        const root = parser.parse(response.data)?.prestashop?.stock_mvts;
        const mvtsRaw = normalizeToArray(root?.stock_mvt);

        if (mvtsRaw.length === 0) {
            warning.value = "Aucun mouvement de stock enregistré.";
            return;
        }

        let listeEnrichie = [];
        
        for (const mvt of mvtsRaw) {
            const idMvt = mvt.id || mvt["@_id"];
            const prodDetails = await getProductDetailsFromStockAvailable(mvt.id_stock);

            if (!prodDetails) continue;

            listeEnrichie.push({
                id: idMvt,
                id_produit: prodDetails.id_product,
                nom_produit: prodDetails.name,
                attributs_produit: prodDetails.attributes,
                quantite: parseInt(mvt.physical_quantity || 0, 10),
                date: mvt.date_add, 
                signe: parseInt(mvt.sign || 1, 10)
            });
        }

        tousLesMouvements.value = listeEnrichie;
        
        // Par défaut au premier chargement, on affiche tout
        appliquerFiltreLocal();

    } catch (err) {
        error.value = "Erreur lors du chargement des mouvements.";
        console.error(err);
    } finally {
        loading.value = false;
    }
};

// Fonction de traitement local (sans appel API) déclenchée par le bouton Rechercher
const appliquerFiltreLocal = () => {
    warning.value = null;

    if (filterType.value === 'all') {
        mouvementsFiltrés.value = [...tousLesMouvements.value];
        return;
    }

    mouvementsFiltrés.value = tousLesMouvements.value.filter(mvt => {
        // Extraction de la partie date YYYY-MM-DD depuis la chaîne date_add (ex: "2026-05-17 14:30:00")
        const dateMvtSèche = mvt.date.split(' ')[0];

        if (filterType.value === 'day' && filterDay.value) {
            return dateMvtSèche === filterDay.value;
        }

        if (filterType.value === 'range') {
            const minOk = filterMin.value ? dateMvtSèche >= filterMin.value : true;
            const maxOk = filterMax.value ? dateMvtSèche <= filterMax.value : true;
            return minOk && maxOk;
        }

        return true;
    });

    if (mouvementsFiltrés.value.length === 0) {
        warning.value = "Aucun mouvement ne correspond à vos critères de recherche.";
    }
};

onMounted(() => {
    fetchMouvements();
});
</script>

<template>
    <div class="mvt-container">
        <div class="entete">
            <h2>Historique des Mouvements de Stock</h2>
            <button type="button" @click="fetchMouvements" class="btn-rafraichir" :disabled="loading">
                Actualiser la base
            </button>
        </div>

        <div class="filtres-conteneur">

            <!-- <div class="filtre-groupe">
                <label>Choisir un jour :</label>
                <input type="date" v-model="filterDay" />
            </div> -->

            <div class="filtre-groupes-dates">
                <div class="filtre-groupe">
                    <label>Date Min :</label>
                    <input type="date" v-model="filterMin" />
                </div>
                <div class="filtre-groupe">
                    <label>Date Max :</label>
                    <input type="date" v-model="filterMax" />
                </div>
            </div>

            <button type="button" @click="appliquerFiltreLocal" class="btn-rechercher" :disabled="loading">
                Rechercher
            </button>
        </div>

        <div v-if="loading" class="info-etat">Chargement et traitement de l'historique...</div>
        <div v-if="error" class="error-msg">{{ error }}</div>
        <div v-if="warning" class="warning-msg">{{ warning }}</div>

        <table v-if="!loading && !error && mouvementsFiltrés.length">
            <thead>
                <tr>
                    <th>ID Mvt</th>
                    <th>Date</th>
                    <th>ID Produit</th>
                    <th>Produit / Attributs</th>
                    <th>Variation</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="mvt in mouvementsFiltrés" :key="mvt.id">
                    <td><code>#{{ mvt.id }}</code></td>
                    <td>{{ mvt.date }}</td>
                    <td><code>#{{ mvt.id_produit }}</code></td>
                    <td>
                        <div class="produit-nom">{{ mvt.nom_produit }}</div>
                        <small v-if="mvt.attributs_produit" class="produit-attributs">
                            {{ mvt.attributs_produit }}
                        </small>
                    </td>
                    <td>
                        <span :class="mvt.signe === 1 ? 'badge-entree' : 'badge-sortie'">
                            {{ mvt.signe === 1 ? '+' : '-' }}{{ mvt.quantite }}
                        </span>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<style scoped>
.mvt-container {
    padding: 20px;
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    margin-top: 20px;
}
.entete {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}
.btn-rafraichir {
    background-color: #607d8b;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
}
.btn-rafraichir:disabled, .btn-rechercher:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
.filtres-conteneur {
    display: flex;
    gap: 20px;
    background-color: #f9f9f9;
    padding: 15px;
    border-radius: 6px;
    margin-bottom: 20px;
    align-items: flex-end;
    flex-wrap: wrap;
    border: 1px solid #eee;
}
.filtre-groupe {
    display: flex;
    flex-direction: column;
    gap: 5px;
}
.filtre-groupe label {
    font-size: 0.85rem;
    color: #555;
    font-weight: 500;
}
.filtre-groupe select, .filtre-groupe input {
    padding: 6px 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.9rem;
}
.filtre-groupes-dates {
    display: flex;
    gap: 15px;
}
.btn-rechercher {
    background-color: #2196f3;
    color: white;
    border: none;
    padding: 8px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
}
.btn-rechercher:hover {
    background-color: #0b7dda;
}
.produit-nom {
    font-weight: 600;
    color: #333;
}
.produit-attributs {
    display: block;
    color: #ffa000;
    font-style: italic;
    margin-top: 2px;
}
.info-etat {
    padding: 10px;
    background: #e1f5fe;
    color: #0288d1;
    border-radius: 4px;
}
table {
    width: 100%;
    border-collapse: collapse;
}
th, td {
    border: 1px solid #eee;
    padding: 12px 10px;
    text-align: left;
}
th {
    background-color: #f5f5f5;
}
.badge-entree {
    background-color: #e6f4ea;
    color: #137333;
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: bold;
}
.badge-sortie {
    background-color: #fce8e6;
    color: #c5221f;
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: bold;
}
.error-msg { color: red; }
.warning-msg { color: orange; }
</style>