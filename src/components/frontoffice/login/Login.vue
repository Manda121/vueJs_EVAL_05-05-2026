<script setup>
import { ref } from 'vue';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import bcrypt from 'bcryptjs';

import Loading from '@/components/inc/Loading.vue';
import Error from '@/components/inc/Error.vue';

import { useRouter } from 'vue-router';
import { setCustomerSession } from '@/utils/frontStorage';

const router = useRouter();

const props = defineProps({
    email: {
        type: String,
        default: ''
    },
    password: {
        type: String,
        default: ''
    }
});

const email = ref(props.email || 'notiavinamandaniaina@gmail.com');
const password = ref(props.password || 'eval@Mai05');
const loading = ref(false);
const error = ref(null);


const parser = new XMLParser({
    textNodeName: "_text"
});

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':'),
        'Content-Type': 'application/xml'
    }
});
const Login = async () => {
    loading.value = true;
    error.value = null;
    try {
        const response = await api.get('/customers', {
            params: { 'display': 'full' }
        });

        const jsonObj = parser.parse(response.data);
        const data = jsonObj?.prestashop?.customers?.customer;
        const listecustomers = Array.isArray(data) ? data : [data];

        const user = listecustomers.find(emp => emp.email === email.value);

        if (user) {
            const validPassword = bcrypt.compareSync(password.value, user.passwd);

            if (validPassword) {

                setCustomerSession(user);
                // router.push('/front/' + redirect.value);
                console.log("Succès !");
            } else {

                error.value = "Mot de passe incorrect.";
            }
        } else {
            error.value = "Utilisateur non trouvé.";
        }

    } catch (err) {
        error.value = "Erreur de connexion.";
    } finally {
        loading.value = false;
    }
}

</script>

<template>
    <div class="login-panel">
        <Loading v-if="loading" message="Connexion..." />
        <Error :error="error" v-if="error" />
        <input type="email" name="email" v-model="email" placeholder="email"><br>
        <input type="password" name="password" v-model="password" placeholder="password"><br>
        <button @click="Login" :disabled="loading">se connecter</button>
    </div>
</template>