<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import Loading from '../inc/Loading.vue';
import Warning from '../inc/Warning.vue';
import Error from '../inc/Error.vue';

import Detailscustomer from './Detailscustomer.vue';
import NewCustomer from './NewCustomer.vue';
import UpdateCustomer from './UpdateCustomer.vue';

const customers = ref([]);
const loading = ref(true);
const warning = ref(null);
const error = ref(null);

const customer_id = ref(null);
const customer_id_upd = ref(null);

const create_customer = ref(false);

// Configuration du parseur
const parser = new XMLParser({
    ignoreAttributes: false, // Garder les attributs si besoin (ex: id)
    attributeNamePrefix: "", // Ne pas ajouter de préfixe aux attributs
    parseTagValue: true,     // Convertit "1" en nombre 1 ou "true" en booléen
    trimValues: true         // Nettoie les espaces blancs automatiquement
});

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
    }
});
const fetchCustomers = async () => {
    loading.value = true;
    error.value = null;

    try {
        const response = await api.get('/customers', {
            params: { 'display': 'full' }
        });

        const jsonObj = parser.parse(response.data);
        const data = jsonObj?.prestashop?.customers?.customer;

        if (!data) {
            warning.value = "Aucun client trouvé.";
            return;
        }

        // On force le format tableau
        const listeClients = Array.isArray(data) ? data : [data];
        customers.value = listeClients;

        // Boucle sur chaque client pour calculer ses ventes
        for (let i = 0; i < customers.value.length; i++) {
            const customer = customers.value[i];
            
            try {
                // Appel API pour les commandes du client i
                const responseOrders = await api.get('/orders', {
                    params: { 
                        'display': 'full',
                        'filter[id_customer]': customer.id 
                    }
                });

                const jsonObjOrders = parser.parse(responseOrders.data);
                const dataOrders = jsonObjOrders?.prestashop?.orders?.order;

                let totalVentes = 0;

                if (dataOrders) {
                    // On force en tableau si une seule commande
                    const listeOrders = Array.isArray(dataOrders) ? dataOrders : [dataOrders];
                    
                    // On additionne les totaux payés
                    for (let j = 0; j < listeOrders.length; j++) {
                        totalVentes = totalVentes + parseFloat(listeOrders[j].total_paid_real);
                    }
                }

                // On ajoute la nouvelle propriété au client
                customer.ventes = totalVentes;

            } catch (errOrder) {
                console.error("Erreur commandes client:", customer.id);
                customer.ventes = 0;
            }
        }

    } catch (err) {
        error.value = "Erreur lors de la récupération ou du traitement des données.";
        console.error("Détails:", err);
    } finally {
        loading.value = false;
    }
};

const direction = ref(1);

function trie(champ) {
    // À chaque clic, on multiplie par -1 (ça bascule entre 1 et -1)
    direction.value = direction.value * -1;

    customers.value.sort((a, b) => {
        // On compare les deux valeurs
        if (a[champ] < b[champ]) {
            return -1 * direction.value;
        }
        if (a[champ] > b[champ]) {
            return 1 * direction.value;
        }
        return 0;
    });
}

onMounted(fetchCustomers);
</script>

<template>
    <div :class="customer_id || create_customer || customer_id_upd ? 'flou' : ''">
        <h2>Liste des clients</h2>

        <button @click="create_customer = true">Ajouter un client</button>

        <Loading v-if="loading" message="Chargement des clients..." />

        <table v-else border="1">
            <thead>
                <tr>
                    <th @click="trie('id')">ID</th>
                    <th @click="trie('lastname')">Nom</th>
                    <th @click="trie('firstname')">Prénom</th>
                    <th @click="trie('email')">Email</th>
                    <th @click="trie('ventes')">Ventes</th>
                    <th @click="trie('active')">Actif</th>
                    <th @click="trie('newsletter')">Lettre d'information</th>
                    <th @click="trie('date_add')" >Inscription</th>
                    <th >Modifier</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="customer in customers" :key="customer.id" style="cursor: grab;">
                    <td @click="customer_id = customer.id">{{ customer.id }}</td>
                    <td @click="customer_id = customer.id">{{ customer.lastname }}</td>
                    <td @click="customer_id = customer.id">{{ customer.firstname }}</td>
                    <td @click="customer_id = customer.id">{{ customer.email }}</td>
                    <td @click="customer_id = customer.id">{{ customer.ventes }}</td>
                    <td @click="customer_id = customer.id">
                        <span :style="{ color: customer.active ? 'green' : 'red' }">
                            {{ customer.active ? 'Oui' : 'Non' }}
                        </span>
                    </td>
                    <td @click="customer_id = customer.id">
                        <span :style="{ color: customer.newsletter ? 'green' : 'red' }">
                            {{ customer.newsletter ? 'Oui' : 'Non' }}
                        </span>
                    </td>
                    <td @click="customer_id = customer.id">{{ customer.date_add }}</td>
                    <td><button @click="customer_id_upd = customer.id">Modifier</button></td>
                </tr>
            </tbody>
        </table>

        <Warning :warning="warning" v-if="warning" />
        <Error :error="error" v-if="error" />
    </div>
    <Detailscustomer v-if="customer_id" v-model="customer_id" />
    <UpdateCustomer v-if="customer_id_upd" v-model="customer_id_upd" />
    <NewCustomer v-if="create_customer" v-model="create_customer" />
</template>

<style scoped>
.flou {
    filter: blur(5px);
}

table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 20px;
}

th,
td {
    padding: 10px;
    text-align: left;
}

th {
    background-color: #f4f4f4;
}
</style>