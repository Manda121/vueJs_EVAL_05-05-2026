<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import Loading from '@/components/inc/Loading.vue';
import Error from '@/components/inc/Error.vue';
import Warning from '@/components/inc/Warning.vue';

const loading = ref(false);
const error = ref(null);
const warning = ref(null);

const paid_state = ref([2, 3, 4, 5, 9, 11]);
const orders = ref([]);

// Variables réactives pour stocker les critères de filtrage
const jour_courant = ref(''); // Par défaut : aujourd'hui
const jour_min = ref('');
const jour_max = ref('');

// Variables temporaires pour lier les inputs de l'interface
const input_jour = ref('');
const input_min = ref('');
const input_max = ref('');

const parser = new XMLParser();
const api = axios.create({
    baseURL: '/api',
    headers: { 'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':') }
});

const fetchOrders = async () => {
    loading.value = true;
    error.value = null;
    warning.value = null;
    orders.value = [];

    try {
        const response = await api.get('/orders', {
            params: { 'display': 'full' }
        });

        const jsonObj = parser.parse(response.data);
        const rawData = jsonObj?.prestashop?.orders?.order;
        const data = Array.isArray(rawData) ? rawData : rawData ? [rawData] : [];

        // On stocke TOUTES les commandes valides dans notre tableau de référence
        const validOrders = [];
        for (const order of data) {
            if (paid_state.value.includes(parseInt(order.current_state))) {
                validOrders.push(order);
            } else {
                // console.log(`Commande ${order.id} ignorée (état actuel: ${order.current_state})`);
            }
        }

        orders.value = validOrders;

        if (orders.value.length === 0) {
            warning.value = "Aucune commande valide trouvée.";
        }

    } catch (err) {
        error.value = "Erreur lors de la récupération de vos commandes.";
        console.error(err);
    } finally {
        loading.value = false;
    }
};

// --- LOGIQUE DES FILTRES SANS REFAIRE D'APPEL API ---

// 1. Filtrage dynamique des commandes
const ordersFiltrees = computed(() => {
    return orders.value.filter(order => {
        // Extraction de la date de la commande (Format YYYY-MM-DD)
        const dateCommande = order.date_add ? order.date_add.split(' ')[0] : '';

        // Mode A : Filtrage par jour précis
        if (jour_courant.value) {
            return dateCommande === jour_courant.value;
        }

        // Mode B : Filtrage par intervalle (min / max optionnels)
        if (jour_min.value && dateCommande < jour_min.value) return false;
        if (jour_max.value && dateCommande > jour_max.value) return false;

        return true;
    });
});

// 2. Calcul des indicateurs du Dashboard basés sur les commandes filtrées
const statistiques = computed(() => {
    let totalCommande = 0;
    let totalHt = 0;
    let totalTtc = 0;

    ordersFiltrees.value.forEach(order => {
        totalCommande++;
        totalHt += parseFloat(order.total_paid_tax_excl) || 0;
        totalTtc += parseFloat(order.total_paid_tax_incl) || 0;
    });

    return {
        nb_commande: totalCommande,
        vente_ht: totalHt,
        vente_ttc: totalTtc
    };
});

// Actions au clic sur les boutons pour appliquer les filtres
function searchDate() {
    jour_min.value = '';
    jour_max.value = '';
    jour_courant.value = input_jour.value;
}

function searchIntervalle() {
    jour_courant.value = '';
    jour_min.value = input_min.value;
    jour_max.value = input_max.value;
}

// Fonction utilitaire pour tout réinitialiser et voir le "Total Général"
function clearFilters() {
    jour_courant.value = '';
    jour_min.value = '';
    jour_max.value = '';
    input_jour.value = '';
    input_min.value = '';
    input_max.value = '';
}

onMounted(fetchOrders);
</script>

<template>
    <div class="orders-container">
        <div>
            <input type="date" v-model="input_jour">
            <button @click="searchDate">Rechercher par jour</button>
        </div>

        <div>
            <input type="date" v-model="input_min" placeholder="Date min">
            <input type="date" v-model="input_max" placeholder="Date max">
            <button @click="searchIntervalle">Recherche par intervalle</button>
            <button @click="clearFilters">Total général (Tout)</button>
        </div>

        <Loading v-if="loading" message="Mise à jour du tableau de bord..." />
        <Warning :warning="warning" v-if="warning" />
        <Error :error="error" v-if="error" />

        <div v-if="!loading">
            <h3>DASHBOARD</h3>
            
            <p v-if="jour_courant">Période : Journée du {{ jour_courant }}</p>
            <p v-else-if="jour_min || jour_max">
                Période : Du {{ jour_min || 'Début' }} au {{ jour_max || 'Fin' }}
            </p>
            <p v-else>Période : Total général</p>

            <div>
                <h2>Nombre de commandes</h2>
                <p>{{ statistiques.nb_commande }}</p>
            </div>
            
            <div>
                <h2>Vente totale HT</h2>
                <p>{{ statistiques.vente_ht.toFixed(2) }} €</p>
            </div>

            <div>
                <h2>Vente totale TTC</h2>
                <p>{{ statistiques.vente_ttc.toFixed(2) }} €</p>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Aucun CSS ajouté, conservation de tes balises et classes */
</style>