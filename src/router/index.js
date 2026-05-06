import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Customer from '../views/customers/Customer.vue'

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