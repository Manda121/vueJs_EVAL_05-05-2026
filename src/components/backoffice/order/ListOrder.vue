<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import Loading from '@/components/inc/Loading.vue';
import Error from '@/components/inc/Error.vue';
import Warning from '@/components/inc/Warning.vue';

const customer_session = ref(JSON.parse(localStorage.getItem('customer_session')));
const orders = ref([]);
const loading = ref(false);
const error = ref(null);
const warning = ref(null);

const cartIn = ref([]);

const parser = new XMLParser();
const api = axios.create({
    baseURL: '/api',
    headers: { 
        'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':'),
        'Content-Type': 'application/xml' // Obligatoire pour envoyer du XML lors du PUT
    }
});

const fetchOrders = async () => {
    loading.value = true;
    error.value = null;
    warning.value = null;

    try {
        const response = await api.get('/orders', {
            params: { 'display': 'full' }
        });

        const jsonObj = parser.parse(response.data);
        const rawData = jsonObj?.prestashop?.orders?.order;
        const data = Array.isArray(rawData) ? rawData : rawData ? [rawData] : [];

        const enrichedOrders = [];

        for (const order of data) {
            cartIn.value.push(order.id_cart);
            
            // On extrait proprement l'ID de l'état actuel
            const currentStateId = typeof order.current_state === 'object' ? order.current_state['#text'] : order.current_state;
            order.current_state = currentStateId; // On stocke l'ID propre pour le select

            try {
                // Récupération du vrai libellé textuel de l'état
                const stateResponse = await api.get(`/order_states/${currentStateId}`);
                const stateJson = parser.parse(stateResponse.data);

                const stateName = stateJson?.prestashop?.order_state?.name?.language;
                
                // Extraction sécurisée du texte selon la structure XML de PrestaShop
                let label = 'État inconnu';
                if (Array.isArray(stateName)) {
                    label = typeof stateName[0] === 'object' ? stateName[0]['#text'] : stateName[0];
                } else if (stateName) {
                    label = typeof stateName === 'object' ? stateName['#text'] : stateName;
                }
                
                order.status_label = label;
            } catch (e) {
                order.status_label = "Erreur état";
            }
            enrichedOrders.push(order);
        }

        orders.value = enrichedOrders;
        if (orders.value.length === 0) {
            warning.value = "Vous n'avez pas encore passé de commande.";
        }

        await fectCarts();
    } catch (err) {
        error.value = "Erreur lors de la récupération de vos commandes.";
        console.error("Erreur lors de la récupération des commandes:", err);
    } finally {
        loading.value = false;
    }
};

const fectCarts = async () => {
    loading.value = true;

    try {
        const response = await api.get('/carts', {
            params: { 'display': 'full' }
        });

        const jsonObj = parser.parse(response.data);
        const rawData = jsonObj?.prestashop?.carts?.cart;
        const data = Array.isArray(rawData) ? rawData : rawData ? [rawData] : [];

        for (const cart of data) {
            if (!cartIn.value.includes(Number(cart.id))) {
                
                const panierCommande = {
                    id: "Panier-" + cart.id, // Identifiable grâce au préfixe "Panier-"
                    id_customer: cart.id_customer,
                    reference: 'EN COURS',
                    date_add: cart.date_add,
                    total_paid_tax_incl: 0,
                    status_label: "Dans le panier", // Vrai nom pour les paniers
                    is_cart: true // Petit indicateur pour savoir que c'est un panier
                };

                orders.value.push(panierCommande);
            }
        }

        if (orders.value.length === 0) {
            warning.value = "Aucune activité trouvée.";
        }
    } catch (err) {
        error.value = "Erreur lors de la récupération des paniers.";
        console.error("Erreur:", err);
    } finally {
        loading.value = false;
    }
};

// FONCTION DE MODIFICATION D'ÉTAT VIA L'API DE PRESTASHOP
const modifierEtatCommande = async (order, evenement) => {
    const nouvelEtatId = evenement.target.value;
    
    if (!nouvelEtatId) return;

    loading.value = true;
    error.value = null;

    try {
        // 1. On récupère d'abord l'XML complet et d'origine de la commande
        const orderResponse = await api.get(`/orders/${order.id}`);
        let xmlComplet = orderResponse.data;

        // 2. On remplace la balise <current_state> actuelle par la nouvelle valeur dans le texte XML
        // PrestaShop renvoie souvent <current_state xlink:href="...">ID</current_state> ou <current_state>ID</current_state>
        // Cette expression régulière basique permet de remplacer proprement le contenu de la balise
        xmlComplet = xmlComplet.replace(/<current_state[^>]*>.*?<\/current_state>/, `<current_state>${nouvelEtatId}</current_state>`);

        // 3. Envoi de l'XML complet et modifié à l'API via PUT
        await api.put(`/orders/${order.id}`, xmlComplet);
        
        // Après le succès de l'API, on refait un GET pour obtenir le nouveau VRAI nom du statut
        const stateResponse = await api.get(`/order_states/${nouvelEtatId}`);
        const stateJson = parser.parse(stateResponse.data);
        const stateName = stateJson?.prestashop?.order_state?.name?.language;

        let nouveauLabel = 'État inconnu';
        if (Array.isArray(stateName)) {
            nouveauLabel = typeof stateName[0] === 'object' ? stateName[0]['#text'] : stateName[0];
        } else if (stateName) {
            nouveauLabel = typeof stateName === 'object' ? stateName['#text'] : stateName;
        }

        // Mise à jour locale de la ligne pour l'affichage immédiat
        order.current_state = parseInt(nouvelEtatId);
        order.status_label = nouveauLabel;

        alert(`Commande #${order.id} mise à jour vers : ${nouveauLabel}`);
    } catch (err) {
        error.value = "Erreur lors de la modification du statut sur l'api.";
        console.error(err);
    } finally {
        loading.value = false;
        // On réinitialise la sélection visuelle du select
        evenement.target.value = "";
    }
};

onMounted(fetchOrders);
</script>

<template>
    <div class="orders-container">
        <h3>Mes Commandes et Paniers</h3>

        <Loading v-if="loading" message="Chargement des commandes" />
        <Error v-else-if="error" :message="error" />
        <Warning v-else-if="warning" :message="warning" />

        <div v-else-if="orders.length === 0">
            <p>Vous n'avez pas encore passé de commande ou de panier.</p>
        </div>

        <table v-else class="orders-table">
            <thead>
                <tr>
                    <th>Référence</th>
                    <th>customer</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>État Actuel</th> <th>Action</th>      </tr>
            </thead>
            <tbody>
                <tr v-for="order in orders" :key="order.id">
                    <td>#{{ order.id }} - {{ order.reference }}</td>
                    <td>{{ order.id_customer }}</td>
                    <td>{{ new Date(order.date_add).toLocaleDateString() }}</td>
                    <td>{{ parseFloat(order.total_paid_tax_incl).toFixed(2) }} €</td>
                    <td>
                        <span class="status-badge">
                            {{ order.status_label }}
                        </span>
                    </td>
                    <td>
                        <select v-if="!order.is_cart" value="" @change="modifierEtatCommande(order, $event)">
                            <option value="" disabled selected>-- Modifier l'état --</option>
                            <option value="2">Paiement accepté</option>
                            <option value="6">Annulé</option>
                        </select>
                        <span v-else>Non modifiable (Panier)</span>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>