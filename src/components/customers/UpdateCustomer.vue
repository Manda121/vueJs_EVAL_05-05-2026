<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import ListGroup from '../groups/ListGroup.vue';


import Loading from '../inc/Loading.vue';
import Warning from '../inc/Warning.vue';
import Error from '../inc/Error.vue';

const update_customer = defineModel();
const groups = ref([]);
const selectedGroups = ref([]); // Par défaut groupe 'Client'

const loading = ref(true);
const warning = ref(null);
const error = ref(null);

const newcustomer = ref({});

const parser = new XMLParser();
const api = axios.create({
    baseURL: '/api',
    headers: { 'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':') }
});

const fetchgroups = async () => {
    try {
        const response = await api.get('/groups', { params: { 'display': 'full' } });
        const jsonObj = parser.parse(response.data);
        const data = jsonObj?.prestashop?.groups?.group;
        groups.value = Array.isArray(data) ? data : [data];
    } catch (err) {
        console.error(err);
    }
};

const fetchCustomer = async () => {
    loading.value = true;
    error.value = null;
    
    try {
        const response = await api.get('/customers/' + update_customer.value, {
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
        newcustomer.value = data;

        selectedGroups.value = Array.isArray(newcustomer.value.associations?.groups?.group) ? newcustomer.value.associations?.groups?.group : [newcustomer.value.associations?.groups?.group];
        selectedGroups.value = selectedGroups.value.map(g => g.id);
        console.log("Client chargé:", newcustomer.value);

    } catch (err) {
        error.value = "Erreur lors de la récupération ou du traitement des données.";
        console.error("Détails:", err);
    } finally {
        loading.value = false;
        fetchgroups();
    }
};

const UpdateCustomer = async () => {
    const builder = new XMLBuilder({ format: true });

    const customerData = {
        prestashop: {
            customer: {
                id: newcustomer.value.id,
                firstname: newcustomer.value.firstname,
                lastname: newcustomer.value.lastname,
                email: newcustomer.value.email,
                passwd: newcustomer.value.password,
                id_default_group: newcustomer.value.id_default_group,
                id_gender: newcustomer.value.gender,
                birthday: newcustomer.value.birthday,
                active: newcustomer.value.active,
                optin: newcustomer.value.optin,
                associations: {
                    groups: {
                        group: selectedGroups.value.map(id => ({ id: id }))
                    }
                }
            }
        }
    };

    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(customerData)}`;
    const api = axios.create({
        baseURL: '/api',
        headers: {
            'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':'),
            'Content-Type': 'application/xml'
        }
    });

    try {
        await api.put('/customers', xmlContent);
        update_customer.value = null;
    } catch (err) {
        console.error(err.response?.data || err);
    }
};

onMounted(fetchCustomer);
</script>

<template>
    <div class="popop">
        <button @click="update_customer = null">X</button> <br>

        <Loading v-if="loading" message="Chargement des clients..." />

        <div v-else>

        <input type="radio" id="male" :value="1" v-model="newcustomer.gender">
        <label for="male">M.</label>
        <input type="radio" id="female" :value="2" v-model="newcustomer.gender">
        <label for="female">Mme</label> <br>

        <input type="text" v-model="newcustomer.firstname" placeholder="Prénom"> <br>
        <input type="text" v-model="newcustomer.lastname" placeholder="Nom"> <br>
        <input type="email" v-model="newcustomer.email" placeholder="Email"> <br>
        <input type="password" v-model="newcustomer.password" placeholder="Mot de passe"> <br>
        <input type="date" v-model="newcustomer.birthday"> <br>

        <p>Groupe par défaut :</p>
        <select v-model="newcustomer.id_default_group">
            <option v-for="group in groups" :key="group.id" :value="group.id">
                {{ Array.isArray(group.name.language) ? group.name.language[0] : group.name.language }}
            </option>
        </select> <br>

        <input type="radio" :value="1" v-model="newcustomer.active">
        <label for="male">Active</label>
        <input type="radio" :value="0" v-model="newcustomer.active">
        <label for="female">Desactive</label> <br>

        <p>offre partenaire</p>
        <input type="radio" :value="1" v-model="newcustomer.optin">
        <label for="male">oui</label>
        <input type="radio" :value="0" v-model="newcustomer.optin">
        <label for="female">non</label> <br>

        <p>Accès aux groupes :</p>
        <label
            style="font-weight: bold; border-bottom: 1px solid #eee; margin-bottom: 5px; width: 100%; text-align: left;">
            <input type="checkbox">
            Tout sélectionner
        </label>
        <!-- <div class="group-list">
            <label v-for="group in groups" :key="group.id">
                <input type="checkbox" :value="group.id" v-model="selectedGroups">
                {{ Array.isArray(group.name.language) ? group.name.language[0] : group.name.language }}
            </label>
        </div> -->

        <ListGroup v-model="selectedGroups" />

        <button @click="UpdateCustomer">Mettre à jour le client</button>
        </div>

        <Warning :warning="warning" v-if="warning" />
        <Error :error="error" v-if="error" />
    </div>
</template>

<style scoped>
.popop {
    position: fixed;
    width: 400px;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border: 1px solid #ccc;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    z-index: 1000;
}

.group-list {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin: 10px 0;
}
</style>