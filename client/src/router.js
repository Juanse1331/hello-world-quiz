import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'ingreso',
    component: () => import('./views/VistaIngreso.vue')
  },
  {
    path: '/competencia',
    name: 'competencia',
    component: () => import('./views/VistaCompetencia.vue')
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('./views/VistaAdmin.vue')
  },
  {
    // El servidor devuelve esta página (401) si alguien abre la API en el navegador
    path: '/api/:pathMatch(.*)*',
    name: 'no-autorizado',
    component: () => import('./views/VistaNoAutorizado.vue')
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
