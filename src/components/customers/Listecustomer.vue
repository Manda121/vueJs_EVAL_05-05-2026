<script setup>
import { ref, onMounted } from 'vue';

const customers = ref([]);
const loading = ref(true);

const API_KEY = '4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB'; 
const API_URL = 'http://localhost/prestashop_edition_classic_version_8.2.6/api/customers';

const fetchCustomers = async () => {
    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + btoa(API_KEY + ':')
            }
        });

        const xmlText = await response.text();

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        
        const customerNodes = xmlDoc.querySelectorAll("customer");

        customers.value = Array.from(customerNodes).map(node => {
            return {
                id: node.getAttribute('id'),
                link: node.getAttribute('xlink:href')
            };
        });

    } catch (error) {
        console.error("Erreur lors de la récupération des clients :", error);
    } finally {
        loading.value = false;
    }
};

onMounted(fetchCustomers);
</script>

<template>
    <div>
        <h2>Liste des clients</h2>
        
        <p v-if="loading">Chargement en cours...</p>

        <table v-else border="1">
            <thead>
                <tr>
                    <th>ID du Client</th>
                    <th>Lien API (Détails)</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="customer in customers" :key="customer.id">
                    <td>{{ customer.id }}</td>
                    <td>{{ customer.link }}</td>
                    <td>
                        <button @click="console.log('Voir détails de:', customer.id)">
                            Détails
                        </button>
                    </td>
                </tr>
            </tbody>
        </table>

        <p v-if="!loading && customers.length === 0">Aucun client trouvé.</p>
    </div>
</template>

<style scoped>
table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 20px;
}
th, td {
    padding: 10px;
    text-align: left;
}
th {
    background-color: #f4f4f4;
}
</style>