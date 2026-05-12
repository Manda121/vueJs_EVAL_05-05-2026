<script setup>
    import Login from '../../../components/frontoffice/login/Login.vue';
    import Singin from '../../../components/frontoffice/login/Singin.vue';
    import { ref } from 'vue';

    const showLogin = ref(true);
</script>

<template>
    <Login v-if="showLogin"/>
    <Singin v-else/>

    <button @click="showLogin = false" v-if="showLogin">s inscrire</button>
    <button @click="showLogin = true" v-else>se connecter</button>
</template>