import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Customer from '../views/customers/Customer.vue'
import CustomerDetails from '../views/customers/CustomerDetails.vue'
import Reinitialisation from '../views/inc/Reinitialisation.vue'
import LoginBO from '../views/backoffice/login/Login.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: Home
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