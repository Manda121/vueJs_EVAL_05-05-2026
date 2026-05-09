<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import ListGroup from '../groups/ListGroup.vue';

const create_customer = defineModel();
const groups = ref([]);
const selectedGroups = ref([]); // Par défaut groupe 'Client'

const newcustomer = ref({
    lastname: '',
    firstname: '',
    email: '',
    password: '',
    id_default_group: 3,
    active: 0,
    birthday: '',
    gender: 1,
    optin : 0
});

// Cette propriété gère l'état de la case "Tout sélectionner"
const allSelected = computed({
    // La case est cochée si tous les groupes sont dans selectedGroups
    get() {
        return groups.value.length > 0 && selectedGroups.value.length === groups.value.length;
    },
    // Quand on clique sur la case
    set(value) {
        if (value) {
            // On remplit le tableau avec tous les IDs des groupes
            selectedGroups.value = groups.value.map(g => g.id);
        } else {
            // On vide le tableau
            selectedGroups.value = [];
        }
    }
});

const fetchgroups = async () => {
    const parser = new XMLParser();
    const api = axios.create({
        baseURL: '/api',
        headers: { 'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':') }
    });
    try {
        const response = await api.get('/groups', { params: { 'display': 'full' } });
        const jsonObj = parser.parse(response.data);
        const data = jsonObj?.prestashop?.groups?.group;
        groups.value = Array.isArray(data) ? data : [data];
    } catch (err) {
        console.error(err);
    }
};

const SaveCustomer = async () => {
    const builder = new XMLBuilder({ format: true });

    const customerData = {
        prestashop: {
            customer: {
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
        await api.post('/customers', xmlContent);
        create_customer.value = null;
        fetchgroups;
    } catch (err) {
        console.error(err.response?.data || err);
    }
};

onMounted(fetchgroups);
</script>

<template>
    <div class="popop">
        <button @click="create_customer = null">X</button> <br>

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
            <input type="checkbox" v-model="allSelected">
            Tout sélectionner
        </label>

        <ListGroup v-model="selectedGroups" />

        <div class="group-list">
            <label v-for="group in groups" :key="group.id">
                <input type="checkbox" :value="group.id" v-model="selectedGroups">
                {{ Array.isArray(group.name.language) ? group.name.language[0] : group.name.language }}
            </label>
        </div>

        <button @click="SaveCustomer">Créer le client</button>
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