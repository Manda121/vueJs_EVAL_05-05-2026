import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Customer from '../views/customers/Customer.vue'
import CustomerDetails from '../views/customers/CustomerDetails.vue'
import Reinitialisation from '../views/inc/Reinitialisation.vue'
import LoginBO from '../views/backoffice/login/Login.vue'
import ListeProduitsFO from '../views/frontoffice/produits/ListeProduits.vue'
import DetailsProduitFO from '../views/frontoffice/produits/DetailsProduit.vue'
import ListePanierFO from '../views/frontoffice/panier/ListePanier.vue'
import LoginFO from '../views/frontoffice/login/Login.vue'
import GetPanierFO from '../views/frontoffice/panier/GtePanier.vue'
import AddresseFO from '../views/frontoffice/addresse/addresse.vue'
import NewOrderFO from '../views/frontoffice/commandes/NewOrder.vue'

const routes = [
  {
    path: '/',
    name: 'loginFO',
    component: LoginFO
  },
  {
    path: '/home/:id',
    name: 'id',
    component: Home
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
    path: '/front/commandes',
    name: 'commandes_front',
    component: NewOrderFO
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

export default router