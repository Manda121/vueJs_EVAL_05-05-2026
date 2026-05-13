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
    headers: { 'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':') }
});
const fetchOrders = async () => {

    loading.value = true;

    try {
        const response = await api.get('/orders', {
            params: {
                'display': 'full'
            }
        });


        const jsonObj = parser.parse(response.data);
        const rawData = jsonObj?.prestashop?.orders?.order;
        // S'assurer que c'est un tableau
        const data = Array.isArray(rawData) ? rawData : rawData ? [rawData] : [];

        const enrichedOrders = [];

        for (const order of data) {
            cartIn.value.push(order.id_cart);
            try {
                // Récupération du libellé de l'état (order_state)
                const stateResponse = await api.get(`/order_states/${order.current_state}`);
                const stateJson = parser.parse(stateResponse.data);

                // On extrait le nom de l'état (souvent dans la première langue disponible)
                const stateName = stateJson?.prestashop?.order_state?.name?.language || 'État inconnu';
                order.status_label = Array.isArray(stateName) ? stateName[0] : stateName;
            } catch (e) {
                order.status_label = "Erreur état";
            }
            enrichedOrders.push(order);
        }

        console.log(cartIn.value);

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
            params: {
                'display': 'full'
            }
        });

        const jsonObj = parser.parse(response.data);
        // Correction du chemin : on cherche dans carts et non orders
        const rawData = jsonObj?.prestashop?.carts?.cart;
        
        const data = Array.isArray(rawData) ? rawData : rawData ? [rawData] : [];

        for (const cart of data) {
            // On vérifie si l'ID du panier n'est PAS dans la liste des paniers commandés
            // On convertit en String ou Number pour être sûr de la comparaison
            if (!cartIn.value.includes(Number(cart.id))) {
                
                // On crée un objet "factice" qui a la même structure qu'une commande
                // pour que le tableau v-for ne plante pas
                const panierCommande = {
                    id: "Panier-" + cart.id, // On préfixe pour différencier l'ID
                    id_customer: cart.id_customer,
                    reference: 'EN COURS',
                    date_add: cart.date_add,
                    total_paid_tax_incl: 0, // Un panier n'est pas encore payé
                    status_label: "Dans le panier" // Ton statut spécial
                };

                // On l'ajoute à la liste globale des commandes
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
}

onMounted(fetchOrders);
</script>

<template>
    <div class="orders-container">
        <h3>Mes Commandes</h3>

        <Loading v-if="loading" message="Chargement des commandes" />
        <Error v-else-if="error" :message="error" />
        <Warning v-else-if="warning" :message="warning" />

        <div v-else-if="orders.length === 0">
            <p>Vous n'avez pas encore passé de commande.</p>
        </div>

        <table v-else class="orders-table">
            <thead>
                <tr>
                    <th>Référence</th>
                    <th>customer</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>État</th>
                </tr>
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
                </tr>
            </tbody>
        </table>
    </div>
</template>