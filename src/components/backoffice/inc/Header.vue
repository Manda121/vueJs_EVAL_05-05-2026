<script setup>
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'; // Importez RouterLink

const user_session = ref(JSON.parse(localStorage.getItem('user_session')));
const router = useRouter();

function disconnect () {
    localStorage.removeItem('user_session'); // On supprime d'abord
    user_session.value = null; // On vide la ref (déclenche la mise à jour visuelle)
    router.push('/login');
}
</script>

<template>
    <header>
        <p>
            <RouterLink to="/customer">customer</RouterLink>
            <RouterLink to="/reinitialisation">reinitialisation</RouterLink>
            
            <RouterLink v-if="!user_session" to="/login">login</RouterLink>
            
            <template v-else>
                <button @click="disconnect">deconnecter</button>
                <span>{{ user_session.firstname }}</span>
            </template>
        </p>
    </header>
</template>