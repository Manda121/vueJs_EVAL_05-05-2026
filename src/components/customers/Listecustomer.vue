<script setup>
import { ref, onMounted } from 'vue';
import Loading from '../inc/Loading.vue'
import Warning from '../inc/Warning.vue'
import Error from '../inc/Error.vue'

const customers = ref([]);
const loading = ref(true);

const warning = ref(null);
const error = ref(null);

const API_KEY = '4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB';
const API_URL = '/api/customers';

const fetchCustomerData = async (id) => {
    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'GET',
            headers: { 'Authorization': 'Basic ' + btoa(API_KEY + ':') }
        });

        if (!response.ok) throw new Error("Erreur API");

        const xmlText = await response.text();

        return transformXmlToJson(xmlText);

    } catch (err) {
        console.error("Erreur:", err);
        return null;
    }
};

const transformXmlToJson = (xmlText) => {

    const res = [];

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const customernode = xmlDoc.querySelector("customer");

    if (!customernode) return null;

    res.push({
        id: customernode.querySelector('id'),
    })
    return res;
};

const fetchCustomers = async () => {
    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + btoa(API_KEY + ':')
            }
        });

        if (!response.ok) {
            error.value = `Erreur ${response.status} : ${response.statusText}`;
            return;
        }

        const xmlText = await response.text();

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");

        const customerNodes = xmlDoc.querySelectorAll("customer");

        customers.value = [];
        for (const node of customerNodes) {

            try {
                const res = await fetch(`${API_URL}/${node.getAttribute('id')}`, {
                    method: 'GET',
                    headers: { 'Authorization': 'Basic ' + btoa(API_KEY + ':') }
                });

                if (!res.ok) throw new Error("Erreur API");

                const xmlText1 = await res.text();
                const parser1 = new DOMParser();
                const xmlDoc1 = parser1.parseFromString(xmlText1, "text/xml");
                const customernode = xmlDoc1.querySelector("customer");

                if (!customernode) return null;

                customers.value.push({
                    id: customernode.querySelector('id').textContent,
                    firstname: customernode.querySelector('firstname').textContent.trim(),
                    lastname: customernode.querySelector('lastname').textContent,
                    email: customernode.querySelector('email').textContent,
                    max_payment_days: customernode.querySelector('max_payment_days').textContent,
                    active: customernode.querySelector('active').textContent,
                    is_guest: customernode.querySelector('is_guest').textContent,
                    date_add: customernode.querySelector('date_add').textContent,
                    date_upd: customernode.querySelector('date_upd').textContent,
                }); 

            } catch (err) {
                console.error("Erreur:", err);
                return null;
            }
        }

        console.log("Clients récupérés :", customers.value);

    } catch (err) {
        error.value = "Erreur lors de la récupération des clients.";
        console.error("Erreur lors de la récupération des clients :", err);
    } finally {
        loading.value = false;
        if (!error.value && customers.value.length === 0) {
            warning.value = "Aucun client trouvé.";
        }
    }
};

onMounted(fetchCustomers);
</script>

<template>
    <div>
        <h2>Liste des clients</h2>

        <!-- <p v-if="loading">Chargement en cours...</p> -->

        <Loading v-if="loading" message="Chargement des clients..." />

        <table v-else border="1">
            <thead>
                <tr>
                    <th>ID du Client</th>
                    <th>Nom</th>
                    <th>Prenom</th>
                    <th>Adresse e_mail</th>
                    <!-- <th>Groupe</th> -->
                    <th>ventes</th>
                    <th>active</th>
                    <!-- <th>lettre d information</th> -->
                    <th>offre partenaire</th>
                    <th>inscription</th>
                    <th>derniere visite</th>
                    <th>action</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="customer in customers" :key="customer.id">
                    <td>{{ customer.id }}</td>
                    <td>{{ customer.firstname }}</td>
                    <td>{{ customer.lastname }}</td>
                    <td>{{ customer.email }}</td>
                    <!-- <td>{{ customer. }}</td> -->
                    <td>{{ customer.max_payment_days }}</td>
                    <td>{{ customer.active }}</td>
                    <!-- <td>{{ customer. }}</td> -->
                    <td>{{ customer.is_guest }}</td>
                    <td>{{ customer.date_add }}</td>
                    <td>{{ customer.date_upd }}</td>
                    <td>action</td>
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