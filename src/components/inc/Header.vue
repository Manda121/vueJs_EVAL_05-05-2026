<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import Login from '@/components/frontoffice/login/Login.vue'
import {
    getCustomerSession,
    getStoredCart,
    removeCustomerSession,
    isGuestCustomer,
    onFrontStorageChange
} from '@/utils/frontStorage'

const connect = ref(false)
const customer_session = ref(getCustomerSession())
const panier_session = ref(getStoredCart())

const updateSession = () => {
    const customer = getCustomerSession()
    customer_session.value = customer
    panier_session.value = getStoredCart()

    if (customer) {
        connect.value = false
    }
}

let interval = null
let stopListen = null

onMounted(() => {
    updateSession()
    interval = setInterval(updateSession, 500)
    stopListen = onFrontStorageChange(function () {
        updateSession()
    })
})

onUnmounted(() => {
    clearInterval(interval)
    if (stopListen) {
        stopListen()
    }
})

function disconnect() {
    // localStorage.removeItem('user_session')
    removeCustomerSession()
    customer_session.value = null
    panier_session.value = getStoredCart()
}
</script>

<template>
    <header class="site-header">
        <nav class="site-nav">
            <RouterLink to="/">Acceils</RouterLink>
            <RouterLink to="/front/produits">produits</RouterLink>
            <RouterLink to="/front/paniers">
                panier
                <span v-if="panier_session && panier_session.idCart">({{ panier_session.idCart }})</span>
            </RouterLink>
            <RouterLink to="/front/commandes">commandes</RouterLink>

            <template v-if="!customer_session">
                <button @click="connect = !connect">
                    {{ connect ? 'annuler' : 'login' }}
                </button>
                <Login v-if="connect" />
            </template>

            <template v-else>
                <span>{{ customer_session.firstname }}</span>
                <span v-if="isGuestCustomer(customer_session)" class="guest-tag">(invite)</span>
                <button @click="disconnect">déconnecter</button>
            </template>
        </nav>
    </header>
</template>