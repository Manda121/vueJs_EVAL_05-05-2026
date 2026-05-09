<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import Loading from '../inc/Loading.vue';
import Warning from '../inc/Warning.vue';
import Error from '../inc/Error.vue';

import ListeGroup from '../groups/ListGroup.vue';

const customer = ref([]);
const loading = ref(true);
const warning = ref(null);
const error = ref(null);

const id_customer = defineModel();

const groups = ref([]);

const selectedGroupIds2 = computed(() => {
    const currentCustomer = customer.value;
    const assocGroups = currentCustomer?.associations?.groups?.group;
    if (!assocGroups) {
        return new Set();
    }

    const assocArray = Array.isArray(assocGroups) ? assocGroups : [assocGroups];
    return new Set(assocArray.map((group) => String(group.id)));
});

const selectedGroupIds = computed(() => {
    const currentCustomer = customer.value;
    const assocGroups = currentCustomer?.associations?.groups?.group;

    // 1. Si pas de groupes, on renvoie une liste vide tout de suite
    if (!assocGroups) {
        return []; 
    }

    // 2. On s'assure d'avoir un tableau (le "if" que tu connais bien)
    const assocArray = Array.isArray(assocGroups) ? assocGroups : [assocGroups];

    // 3. ON REMPLACE LE MAP PAR UNE BOUCLE CLASSIQUE
    let maListeDids = []; // On crée un panier vide

    for (let i = 0; i < assocArray.length; i++) {
        // On prend l'objet groupe à la position i
        let unGroupe = assocArray[i]; 
        
        // On extrait son ID et on le transforme en texte
        let lId = String(unGroupe.id);
        
        // On l'ajoute dans notre panier
        maListeDids.push(lId);
    }

    // 4. On renvoie le panier rempli
    return maListeDids;
});

// Configuration du parseur
const parser = new XMLParser({});

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
    }
});

const api2 = axios.create({
    baseURL: '/api',
    headers: {
        'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
    }
});

const fetchgroups = async () => {

    try {
        const response = await api2.get('/groups', { params: { 'display': 'full' } });
        const jsonObj = parser.parse(response.data);
        const data = jsonObj?.prestashop?.groups?.group;
        groups.value = data;
    } catch (err) {
        console.error(err);
    }
};

const fetchCustomer = async () => {
    loading.value = true;
    error.value = null;
    
    try {
        const response = await api.get('/customers/' + id_customer.value, {
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
        customer.value = data;

        console.log("Client chargé:", customer.value);

    } catch (err) {
        error.value = "Erreur lors de la récupération ou du traitement des données.";
        console.error("Détails:", err);
    } finally {
        loading.value = false;
    }
};

onMounted(fetchCustomer);
onMounted(fetchgroups);
</script>

<template>
    <div class="popop">

        <h2>Liste des clients</h2>

        <button @click="id_customer = null">X</button>

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
                </tr>
            </thead>
            <tbody>
                <tr>
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
                </tr>
            </tbody>
        </table>

        <ListeGroup :v-model="selectedGroupIds" />

        <ul>group</ul>
        <li v-for="group in groups" :key="group.id">
            <input type="checkbox" :value="group.id" :checked="selectedGroupIds.includes(String(group.id))" />
            {{ Array.isArray(group.name.language) ? group.name.language[0] : group.name.language }}
        </li>

        <Warning :warning="warning" v-if="warning" />
        <Error :error="error" v-if="error" />
    </div>
</template>

<style scoped>

.popop {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: white;
    padding: 20px;
    border: 1px solid #ccc;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 1000;
    position: absolute;
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