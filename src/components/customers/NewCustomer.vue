<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

const create_customer = defineModel();

const groups = ref([]);

const fetchgroups = async () => {

    const parser = new XMLParser({
    });

    const api = axios.create({
        baseURL: '/api',
        headers: {
            'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
        }
    });
    try {
        const response = await api.get('/groups', {
            params: { 'display': 'full' }
        });

        // Conversion XML -> JSON
        const jsonObj = parser.parse(response.data);


        // Accès aux données selon la structure PrestaShop : <prestashop><groups><group>
        const data = jsonObj?.prestashop?.groups?.group;

        // Si l'API renvoie un seul groupe, fast-xml-parser peut renvoyer un objet au lieu d'un tableau.
        // On force le format tableau pour le v-for du template.
        groups.value = Array.isArray(data) ? data : [data];
        console.log("Données parsées JSON:", groups);

    } catch (err) {
        console.error("Détails:", err);
    } finally {
    }
};

const newcustomer = ref({
    lastname: '',
    firstname: '',
    email: '',
    password: '',
    id_default_group: '',
    active: 0,
    birthday: ''
});

const SaveCustomer = async () => {
    // 1. Initialiser le Builder
    const builder = new XMLBuilder({
        format: true, // optionnel : pour avoir un XML lisible dans la console
        ignoreAttributes: false
    });

    // 2. Préparer l'objet au format PrestaShop
    // Attention : on utilise "passwd" pour le mot de passe
    const customerData = {
        prestashop: {
            customer: {
                firstname: newcustomer.value.firstname,
                lastname: newcustomer.value.lastname,
                email: newcustomer.value.email,
                passwd: newcustomer.value.password, // Nom interne PS
                id_default_group: newcustomer.value.id_default_group,
                active: 1, // On l'active par défaut
                birthday: newcustomer.value.birthday
            }
        }
    };

    // 3. Convertir en chaîne XML
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(customerData)}`;

    // Re-déclarer l'api ou utiliser une instance globale
    const api = axios.create({
        baseURL: '/api',
        headers: {
            'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':'),
            'Content-Type': 'application/xml' // Crucial pour le POST
        }
    });

    try {
        const response = await api.post('/customers', xmlContent);
        console.log("Client créé avec succès:", response.data);
    } catch (err) {
        // En cas d'erreur, PrestaShop renvoie souvent du XML expliquant le problème
        console.error("Erreur lors de la création:", err.response?.data || err);
    }
};

onMounted(fetchgroups);
</script>

<template>
    <div>
        <input type="text" name="firstname" id="" v-model="newcustomer.firstname" placeholder="firstname">
        <input type="text" name="lastname" id="" v-model="newcustomer.lastname" placeholder="lastname">
        <input type="email" name="email" id="" v-model="newcustomer.email" placeholder="email">
        <input type="password" name="password" id="" v-model="newcustomer.password" placeholder="password">
        <input type="date" name="birthday" id="" v-model="newcustomer.birthday" placeholder="birthday">
        <select name="id_default_group" id="" v-model="newcustomer.id_default_group">
            <option v-for="group in groups" :value="group.id">{{ group.name.language[0]}}</option>
        </select>

        <button @click="SaveCustomer">Create Customer</button>
    </div>
</template>