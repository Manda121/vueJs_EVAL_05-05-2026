<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
// Importation du composant enfant
import StockProduit from './StockProduit.vue';

const loading = ref(false);
const error = ref(null);
const warning = ref(null);

const listeProduits = ref([]); // Contiendra la liste propre des IDs numériques

// Activation de la lecture des attributs XML avec ignoreAttributes: false
const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ""
});

// Configuration de l'API (identique à votre méthode)
const api = axios.create({
    baseURL: '/api',
    headers: {
        'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
    }
});

// Votre fonction utilitaire pour sécuriser les tableaux
const normalizeToArray = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
};

// Fonction pour récupérer tous les produits de la boutique
const fetchTousLesProduits = async () => {
    loading.value = true;
    error.value = null;
    warning.value = null;
    listeProduits.value = [];

    try {
        // On demande la liste de tous les produits à PrestaShop
        const response = await api.get('/products');
        const root = parser.parse(response.data)?.prestashop?.products;
        
        // On récupère le tableau brut des balises <product>
        const produitsRaw = normalizeToArray(root?.product);

        if (produitsRaw.length === 0) {
            warning.value = "Aucun produit trouvé sur la boutique.";
            return;
        }

        // --- CORRECTION DU BUG UNDEFINED ---
        // On extrait proprement l'ID pour chaque produit trouvé
        let listeNettoyee = [];
        for (const prod of produitsRaw) {
            // PrestaShop met l'ID dans l'attribut de la balise, ou parfois directement dans l'objet
            const cleanId = prod.id || prod["@_id"] || prod;
            
            if (cleanId) {
                listeNettoyee.push(cleanId);
            }
        }

        // On stocke notre tableau d'identifiants bien propres (ex: [1, 2, 3, 5])
        listeProduits.value = listeNettoyee;

    } catch (err) {
        error.value = "Erreur lors du chargement de la liste des produits.";
        console.error("Détails liste produits:", err);
    } finally {
        loading.value = false;
    }
};

// Charger la liste au montage du composant
onMounted(() => {
    fetchTousLesProduits();
});
</script>

<template>
    <div class="liste-stocks-container">
        <h2>Gestion globale des Stocks</h2>
        <p>Voici l'état des stocks pour tous les produits de la boutique :</p>

        <div v-if="loading" class="info-etat">Chargement de la liste des produits...</div>
        <div v-if="error" class="error-msg">{{ error }}</div>
        <div v-if="warning" class="warning-msg">{{ warning }}</div>

        <div v-if="!loading && !error && listeProduits.length" class="grille-stocks">
            
            <div 
                v-for="idProduit in listeProduits" 
                :key="idProduit" 
                class="carte-produit-stock"
            >
                <StockProduit :productId="idProduit" />
            </div>

        </div>
    </div>
</template>
