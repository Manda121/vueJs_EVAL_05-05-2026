<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import Loading from '../inc/Loading.vue';
import Warning from '../inc/Warning.vue';
import Error from '../inc/Error.vue';

const customers = ref([]);
const loading = ref(true);
const warning = ref(null);
const error = ref(null);

const props = defineProps({id_customer:Number});

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

const fetchCustomer = async () => {
    loading.value = true;
    error.value = null;
    
    try {
        const response = await api.get('/customers/' + props.id_customer, {
            params: { 'display': 'full' }
        });
        
        // Conversion XML -> JSON
        const jsonObj = parser.parse(response.data);

        console.log("Données parsées JSON:", jsonObj);

        // Accès aux données selon la structure PrestaShop : <prestashop><customers><customer>
        const data = jsonObj?.prestashop?.customer;

        if (!data) {
            warning.value = "Aucun client trouvé.";
            return;
        }

        // Si l'API renvoie un seul client, fast-xml-parser peut renvoyer un objet au lieu d'un tableau.
        // On force le format tableau pour le v-for du template.
        customers.value = Array.isArray(data) ? data : [data];

    } catch (err) {
        error.value = "Erreur lors de la récupération ou du traitement des données.";
        console.error("Détails:", err);
    } finally {
        loading.value = false;
    }
};

onMounted(fetchCustomer);
</script>

<template>
    <div>
        <h2>Liste des clients</h2>
        <Loading v-if="loading" message="Chargement des clients..." />

        <table v-else border="1">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Email</th>
                    <th>Ventes</th>
                    <th>Actif</th>
                    <th>Inscription</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="customer in customers" :key="customer.id">
                    <td>{{ customer.id }}</td>
                    <td>{{ customer.lastname }}</td>
                    <td>{{ customer.firstname }}</td>
                    <td>{{ customer.email }}</td>
                    <td>{{ customer.max_payment_days }}</td>
                    <td>
                        <span :style="{ color: customer.active ? 'green' : 'red' }">
                            {{ customer.active ? 'Oui' : 'Non' }}
                        </span>
                    </td>
                    <td>{{ customer.date_add }}</td>
                    <td><button>Gérer</button></td>
                </tr>
            </tbody>
        </table>

        <Warning :warning="warning" v-if="warning" />
        <Error :error="error" v-if="error" />
    </div>
</template>

<style scoped>
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