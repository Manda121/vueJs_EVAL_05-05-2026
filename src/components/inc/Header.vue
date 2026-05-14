<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import Login from '@/components/frontoffice/login/Login.vue'

const connect = ref(false)
const customer_session = ref(JSON.parse(localStorage.getItem('customer_session')))

// Fonction pour synchroniser la ref avec le localStorage
const updateSession = () => {
    const data = localStorage.getItem('customer_session')
    customer_session.value = JSON.parse(data)
    
    // Si on vient de se connecter (data existe), on ferme le formulaire
    if (data) {
        connect.value = false
    }
}

// On écoute les changements du localStorage (utile si Login écrit dedans)
// Note: 'storage' natif marche surtout entre onglets, 
// donc on va aussi vérifier à intervalle court pour être sûr
let interval = null

onMounted(() => {
    interval = setInterval(updateSession, 500) // Vérifie toutes les 500ms
})

onUnmounted(() => {
    clearInterval(interval) // Nettoie la mémoire
})

function disconnect() {
    localStorage.removeItem('user_session')
    localStorage.removeItem('customer_session')
    localStorage.removeItem('cart_session')
    customer_session.value = null
}
</script>

<template>
    <header>
        <p>
            <RouterLink to="/">Acceils</RouterLink>
            <RouterLink to="/front/produits">produits</RouterLink>
            <RouterLink to="/front/paniers">panier</RouterLink>
            <RouterLink to="/front/commandes">commandes</RouterLink>
            <RouterLink to="/back/commandes">back_commande</RouterLink>
            <RouterLink to="/reinitialisation">back_produits</RouterLink>

            <template v-if="!customer_session">
                <button @click="connect = !connect">
                    {{ connect ? 'annuler' : 'login' }}
                </button>
                <Login v-if="connect" />
            </template>

            <template v-else>
                <span>{{ customer_session.firstname }}</span>
                <button @click="disconnect">déconnecter</button>
            </template>
        </p>
    </header>
</template>

<style scoped>
header {
    padding: 1rem;
    border-bottom: 1px solid #ccc;
}
header p {
    display: flex;
    gap: 15px;
    align-items: center;
}
button {
    cursor: pointer;
}
</style>