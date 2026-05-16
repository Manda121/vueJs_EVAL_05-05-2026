import { createRouter, createWebHistory } from 'vue-router'
import { getUserSession, requiresBackofficeAuth } from '@/utils/backStorage'
import Home from '../views/Home.vue'
import Customer from '../views/customers/Customer.vue'
import CustomerDetails from '../views/customers/CustomerDetails.vue'
import Reinitialisation from '../views/backoffice/reinitialisation/Reinitialisation.vue'
import LoginBO from '../views/backoffice/login/Login.vue'
import ListeProduitsFO from '../views/frontoffice/produits/ListeProduits.vue'
import DetailsProduitFO from '../views/frontoffice/produits/DetailsProduit.vue'
import ListePanierFO from '../views/frontoffice/panier/ListePanier.vue'
import LoginFO from '../views/frontoffice/login/Login.vue'
import GetPanierFO from '../views/frontoffice/panier/GetPanier.vue'
import AddresseFO from '../views/frontoffice/addresse/Addresse.vue'
import NewOrderFO from '../views/frontoffice/commandes/NewOrder.vue'
import ListeOrderFO from '@/views/frontoffice/orders/ListeOrder.vue'
import ListeOrderBO from '@/views/backoffice/order/ListeOrder.vue'
import Dashboard from '@/views/backoffice/Dashoboard/Dashboard.vue'

const routes = [
  {
    path: '/',
    name: 'loginFO',
    component: LoginFO
  },
  {
    path: '/back',
    name: 'Dashboard',
    component: Dashboard
  },
  {
    path: '/back/commandes',
    name: 'liste_commandes',
    component: ListeOrderBO
  },
  {
    path: '/home/:id',
    name: 'id',
    component: Home
  },
  {
    path: '/customer',
    name: 'customer',
    component: Customer
  },
  {
    path: '/customer/:id',
    name: 'CustomerDetail',
    component: CustomerDetails
  },
  {
    path: '/reinitialisation',
    name: 'Reinitialisation',
    component: Reinitialisation
  },
  {
    path: '/login',
    name: 'login',
    component: LoginBO
  },
  {
    path: '/front/produits',
    name: 'produits_front',
    component: ListeProduitsFO
  },
  {
    path: '/front/produits/:id',
    name: 'details_produits_front',
    component: DetailsProduitFO
  },
  // {
  //   path: '/front/paniers',
  //   name: 'panier_front',
  //   component: ListePanierFO
  // },
  {
    path: '/front/paniers',
    name: 'panier_front',
    component: GetPanierFO
  },
  {
    path: '/front/addresses',
    name: 'addresses_front',
    component: AddresseFO
  },
  {
    path: '/front/commandes/new',
    name: 'commandes_front_new',
    component: NewOrderFO
  },
  {
    path: '/front/commandes',
    name: 'commandes_front_list',
    component: ListeOrderFO
  }

  // {
  //   path: '/',
  //   name: 'dashboard',
  //   component: DashboardView
  // }
  // ,
  // {
  //   path: '/evolution',
  //   name: 'evolution',
  //   component: () => import('../views/EvolutionView.vue')
  // }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  if (requiresBackofficeAuth(to.path) && !getUserSession()) {
    next('/login')
  } else {
    next()
  }
})

export default router