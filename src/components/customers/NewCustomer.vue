<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

const create_customer = defineModel();

const groups = ref([]);

const newcustomer = ref({
    lastname: '',
    firstname: '',
    email: '',
    password: '',
    id_default_group: '',
    active: 0,
    birthday: '',
    gender: ''
});

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
                birthday: newcustomer.value.birthday,
                id_gender: newcustomer.value.gender
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
    <div class="popop">

        <button @click="create_customer = null">X</button>

        <input type="radio" name="gender" id="male" value="1" v-model="newcustomer.gender">
        <label for="male">Male</label>
        <input type="radio" name="gender" id="female" value="2" v-model="newcustomer.gender">
        <label for="female">Female</label> <br>
        <input type="text" name="firstname" id="" v-model="newcustomer.firstname" placeholder="firstname"> <br>
        <input type="text" name="lastname" id="" v-model="newcustomer.lastname" placeholder="lastname"> <br>
        <input type="email" name="email" id="" v-model="newcustomer.email" placeholder="email"> <br>
        <input type="password" name="password" id="" v-model="newcustomer.password" placeholder="password"> <br>
        <input type="date" name="birthday" id="" v-model="newcustomer.birthday" placeholder="birthday"> <br>
        <select name="id_default_group" id="" v-model="newcustomer.id_default_group"> <br>
            <option v-for="group in groups" :value="group.id">{{ group.name.language[0] }}</option>
        </select> <br>

        <button @click="SaveCustomer">Create Customer</button>
    </div>
</template>

<style scoped>
.popop {
    position: fixed;
    width: 70%;
    justify-content: center;
    text-align: center;
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
</style>