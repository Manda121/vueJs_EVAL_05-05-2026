<script setup>
import { ref, computed, onMounted } from 'vue';
import { XMLParser } from 'fast-xml-parser';
import Loading from '@/components/inc/Loading.vue';
import Warning from '@/components/inc/Warning.vue';
import Error from '@/components/inc/Error.vue';
import axios from 'axios';

const commandesRaw = ref([]);
const loading = ref(true);
const error = ref(null);
const warning = ref(null);

// Variable réactive pour le filtre de date (ex: "2026-05-16")
const r_date_filtre = ref(''); 

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

// Fonction de récupération des commandes
const fetchOrders = async () => {
    loading.value = true;
    error.value = null;
    warning.value = null;
    commandesRaw.value = [];

    try {
        const response = await api.get('/orders', {
            params: {
                'display': 'full'
            }
        });

        const jsonObj = parser.parse(response.data);
        const data = jsonObj?.prestashop?.orders?.order;

        if (!data) {
            warning.value = "Aucune commande enregistrée.";
            return;
        }

        const listeBrute = Array.isArray(data) ? data : [data];
        
        // Nettoyage des données pour le traitement JavaScript
        commandesRaw.value = listeBrute.map(cmd => {
            const idRaw = typeof cmd.id === 'object' ? cmd.id['#text'] : cmd.id;
            const totalRaw = typeof cmd.total_paid === 'object' ? cmd.total_paid['#text'] : cmd.total_paid;
            const dateRaw = typeof cmd.date_add === 'object' ? cmd.date_add['#text'] : cmd.date_add;
            const stateRaw = typeof cmd.current_state === 'object' ? cmd.current_state['#text'] : cmd.current_state;

            return {
                id: parseInt(idRaw),
                total_paid: parseNumber(totalRaw),
                // PrestaShop renvoie "YYYY-MM-DD HH:MM:SS". On coupe à l'espace pour garder "YYYY-MM-DD"
                date_jour: dateRaw ? dateRaw.split(' ')[0] : '',
                etat: stateRaw
            };
        });

    } catch (err) {
        error.value = "Erreur lors du chargement des statistiques du tableau de bord.";
        console.error("Détails:", err);
    } finally {
        loading.value = false;
    }
};

// --- LOGIQUE DE FILTRAGE INSTANTANÉ CÔTÉ CLIENT ---

// Étape 1 : Filtrer le tableau brut selon la date sélectionnée
const commandesFiltrees = computed(() => {
    if (!r_date_filtre.value) {
        return commandesRaw.value; // Si vide, on affiche tout (statistiques générales)
    }
    return commandesRaw.value.filter(cmd => cmd.date_jour === r_date_filtre.value);
});

// Étape 2 : Calculer les indicateurs clés (KPI) basés sur la liste filtrée
const statistiques = computed(() => {
    const totalCommandes = commandesFiltrees.value.length;
    
    // Somme des montants encaissés
    const chiffreAffaires = commandesFiltrees.value.reduce((accumulateur, cmd) => {
        return accumulateur + cmd.total_paid;
    }, 0);
    
    // Calcul automatique du panier moyen
    const panierMoyen = totalCommandes > 0 ? (chiffreAffaires / totalCommandes) : 0;

    return {
        nombre: totalCommandes,
        montant: chiffreAffaires.toFixed(2),
        panierMoyen: panierMoyen.toFixed(2)
    };
});

onMounted(fetchOrders);
</script>

<template>
    <div>
        <div class="dashboard-controls">
            <label>Sélectionner un jour : </label>
            <input type="date" v-model="r_date_filtre">
            <button v-if="r_date_filtre" @click="r_date_filtre = ''">Vue Générale (Tout)</button>
        </div>

        <Loading v-if="loading" message="Calcul des indicateurs en cours..." />
        <Warning :warning="warning" v-if="warning" />
        <Error :error="error" v-if="error" />

        <div v-if="!loading && !error" class="kpi-container">
            
            <div class="kpi-card">
                <h3>Nombre de commandes</h3>
                <p><strong>{{ statistiques.nombre }}</strong></p>
            </div>

            <div class="kpi-card">
                <h3>Chiffre d'Affaires global</h3>
                <p><strong>{{ statistiques.montant }} €</strong></p>
            </div>

            <div class="kpi-card">
                <h3>Panier Moyen</h3>
                <p><strong>{{ statistiques.panierMoyen }} €</strong></p>
            </div>

        </div>

        <table v-if="commandesFiltrees.length && !loading">
            <tr>
                <th>ID Commande</th>
                <th>Date de vente</th>
                <th>État de commande (ID)</th>
                <th>Montant Payé TTC</th>
            </tr>
            <tr v-for="cmd in commandesFiltrees" :key="cmd.id">
                <td>#{{ cmd.id }}</td>
                <td>{{ cmd.date_jour }}</td>
                <td>{{ cmd.etat }}</td>
                <td>{{ cmd.total_paid.toFixed(2) }} €</td>
            </tr>
        </table>
    </div>
</template>
