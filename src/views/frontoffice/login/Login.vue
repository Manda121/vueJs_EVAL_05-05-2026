<script setup>
    import Login from '../../../components/frontoffice/login/Login.vue';
    import Singin from '../../../components/frontoffice/login/Singin.vue';
    import ListeLogin from '@/components/frontoffice/login/ListeLogin.vue';

    import { ref } from 'vue';

    const showLogin = ref(true);

</script>

<template>
    <div>
        Login
        <Login v-if="showLogin"/>
        <Singin v-else/>
        <a href="/front/produits">anonyme</a>
    </div>
    <button @click="showLogin = false" v-if="showLogin">s inscrire</button>
    <button @click="showLogin = true" v-else>se connecter</button>
    <div>
        <h1>choisir</h1>
        <ListeLogin/>
    </div>

</template>