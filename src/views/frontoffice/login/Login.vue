<script setup>
    import Login from '../../../components/frontoffice/login/Login.vue';
    import Singin from '../../../components/frontoffice/login/Singin.vue';
    import ListeLogin from '@/components/frontoffice/login/ListeLogin.vue';

    import { ref } from 'vue';

    const showLogin = ref(true);

    function anonymous() {
        localStorage.removeItem('customer_session');
        window.location.href = '/front/produits';
    }

</script>

<template>
    <div>
        Login
        <Login v-if="showLogin"/>
        <Singin v-else/>
        <button @click="anonymous">anonyme</button>
    </div>
    <button @click="showLogin = false" v-if="showLogin">s inscrire</button>
    <button @click="showLogin = true" v-else>se connecter</button>
    <div>
        <h1>choisir</h1>
        <ListeLogin/>
    </div>

</template>