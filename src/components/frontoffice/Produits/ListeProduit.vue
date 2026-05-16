<script setup>
import { ref, computed } from 'vue';
import { XMLParser } from 'fast-xml-parser';
import Loading from '@/components/inc/Loading.vue';
import Warning from '@/components/inc/Warning.vue';
import Error from '@/components/inc/Error.vue';
import axios from 'axios';

import { onMounted } from 'vue';

const produitsRaw = ref([]); // Contiendra la liste brute venue de l'API
const loading = ref(true);
const warning = ref(null);
const error = ref(null);

const r_nom = ref('');
const r_categories = ref([]); 
const r_prix_min = ref('');
const r_prix_max = ref('');

// Tableau qui va stocker les vraies catégories venues de PrestaShop
const listeCategoriesPrestashop = ref([]);

// Configuration d'origine sans aucun paramètre
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

// --- LOGIQUE FILTRE PRIX CÔTÉ CLIENT (COMPUTED) ---
// Ce tableau filtre automatiquement "produitsRaw" dès que r_prix_min ou r_prix_max changent
const produits = computed(() => {
    return produitsRaw.value.filter(produit => {
        const prixProduit = parseNumber(produit.price);
        const min = r_prix_min.value !== '' ? parseFloat(r_prix_min.value) : null;
        const max = r_prix_max.value !== '' ? parseFloat(r_prix_max.value) : null;

        if (min !== null && prixProduit < min) return false;
        if (max !== null && prixProduit > max) return false;
        
        return true;
    });
});

// Étape 1 : Charger dynamiquement les catégories depuis PrestaShop
const fetchCategories = async () => {
    try {
        const response = await api.get('/categories', {
            params: { 'display': 'full' }
        });
        const jsonObj = parser.parse(response.data);
        const data = jsonObj?.prestashop?.categories?.category;
        
        if (data) {
            const listeRaw = Array.isArray(data) ? data : [data];
            
            // Extraction et filtrage : on exclut les ID <= 2
            listeCategoriesPrestashop.value = listeRaw.map(cat => {
                let nameStr = '';
                if (cat.name?.language) {
                    nameStr = Array.isArray(cat.name.language) ? cat.name.language[0] : cat.name.language;
                    if (typeof nameStr === 'object') nameStr = nameStr['#text'] || '';
                }
                
                const catId = typeof cat.id === 'object' ? cat.id['#text'] : cat.id;

                return {
                    id: catId,
                    name: nameStr || `Catégorie #${catId}`
                };
            }).filter(cat => {
                const numericId = parseInt(cat.id);
                return numericId > 2;
            });
        }
    } catch (err) {
        console.error("Impossible de charger les catégories PrestaShop:", err);
    }
};

// Étape 2 : Récupérer les produits filtrés (uniquement par Nom et Catégorie via l'API)
const fetchProducts = async () => {
    loading.value = true;
    error.value = null;
    warning.value = null;
    produitsRaw.value = [];

    const queryParams = {
        'display': 'full'
    };

    // Filtre Nom (Contient le texte)
    if (r_nom.value.trim()) {
        queryParams['filter[name]'] = `%[${r_nom.value.trim()}]%`;
    }

    // Filtre Catégories multiples [id1|id2]
    if (r_categories.value.length > 0) {
        const chaineCategories = r_categories.value.join('|');
        queryParams['filter[id_category_default]'] = `[${chaineCategories}]`;
    }

    try {
        const response = await api.get('/products', {
            params: queryParams
        });

        const jsonObj = parser.parse(response.data);
        const data = jsonObj?.prestashop?.products?.product;

        if (!data) {
            warning.value = "Aucun produit trouvé.";
            return;
        }

        const listeproduits = Array.isArray(data) ? data : [data];
        
        for (const produit of listeproduits) {
            // Extraction sécurisée des valeurs en cas d'objet complexe [#text]
            const priceRaw = typeof produit.price === 'object' ? produit.price['#text'] : produit.price;
            const dateUpdRaw = typeof produit.date_upd === 'object' ? produit.date_upd['#text'] : produit.date_upd;
            
            // On ré-assigne la valeur propre pour le template HTML
            produit.price = priceRaw;

            const date_upd = new Date(dateUpdRaw);
            const date_now = new Date();

            const differenceEnMs = date_now - date_upd;
            const differenceEnJours = differenceEnMs / (1000 * 60 * 60 * 24);
            
            if (differenceEnJours <= 1) {
                produit.desc = 'HOT';
            } else if (differenceEnJours > 1 && differenceEnJours <= 7) {
                produit.desc = 'NEW';
            } else if (differenceEnJours > 7) {
                produit.desc = 'OLD';
            }
        }
        
        // Tri par ID croissant
        listeproduits.sort((a, b) => {
            const idA = typeof a.id === 'object' ? parseInt(a.id['#text']) : parseInt(a.id);
            const idB = typeof b.id === 'object' ? parseInt(b.id['#text']) : parseInt(b.id);
            return idA - idB;
        });

        produitsRaw.value = listeproduits;

    } catch (err) {
        error.value = "Erreur lors de la récupération ou du traitement des données.";
        console.error("Détails:", err);
    } finally {
        loading.value = false;
    }
};

// Chargement initial des catégories, puis des produits
onMounted(async () => {
    await fetchCategories();
    await fetchProducts();
});

</script>

<template>
    <div>
        <div class="search-bar">
            <input type="text" v-model="r_nom" placeholder="Rechercher par nom...">
            
            <div class="categories-checkboxes">
                <span>Catégories :</span>
                <label v-for="cat in listeCategoriesPrestashop" :key="cat.id">
                    <input type="checkbox" :value="cat.id" v-model="r_categories">
                    {{ cat.name }}
                </label>
            </div>

            <input type="number" step="any" v-model="r_prix_min" placeholder="Prix Min (€)">
            <input type="number" step="any" v-model="r_prix_max" placeholder="Prix Max (€)">

            <button @click="fetchProducts" :disabled="loading">Rechercher</button>
        </div>

        <Loading v-if="loading" message="Chargement des produits..." />
        <Warning :warning="warning" v-if="warning" />
        <Error :error="error" v-if="error" />
        
        <table v-if="produits.length">
            <tr>
                <th>image</th>
                <th>produit</th>
                <th>desc</th>
                <th>prix</th>
            </tr>
            <tr v-for="produit in produits">
                <td>
                    <a :href="'/front/produits/' + (typeof produit.id === 'object' ? produit.id['#text'] : produit.id)">
                        <img :src="`http://localhost/prestashop_edition_classic_version_8.2.6/api/images/products/${typeof produit.id === 'object' ? produit.id['#text'] : produit.id}/${typeof produit.id_default_image === 'object' ? produit.id_default_image['#text'] : produit.id_default_image}?ws_key=4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB`"
                            :alt="'image de produit'">
                    </a>
                </td>
                <td><strong>{{ typeof produit.id === 'object' ? produit.id['#text'] : produit.id }}</strong></td>
                <td>
                    <div v-if="produit.name?.language && Array.isArray(produit.name.language)">
                        {{ typeof produit.name.language[0] === 'object' ? produit.name.language[0]['#text'] : produit.name.language[0] }}
                    </div>
                    <div v-else-if="produit.name?.language">
                        {{ typeof produit.name.language === 'object' ? produit.name.language['#text'] : produit.name.language }}
                    </div>
                </td>
                <td>{{ produit.desc }} </td>
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
        
        <div v-else-if="!loading && produitsRaw.length > 0">
            <p>Aucun produit ne correspond à cette tranche de prix.</p>
        </div>
    </div>
</template>

<style scoped>
img {
    width: 5%;
}
</style>