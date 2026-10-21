import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'ingreso',
    component: () => import('./views/VistaIngreso.vue')
  },
  {
    path: '/sala',
    name: 'sala',
    component: () => import('./views/VistaSala.vue')
  },
  {
    path: '/resultados',
    name: 'resultados',
    component: () => import('./views/VistaResultadosEstudiante.vue')
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('./views/VistaAdmin.vue')
  },
  {
    path: '/reto',
    name: 'reto',
    component: () => import('./views/VistaReto.vue')
  },
  {
    path: '/admin/retos',
    name: 'admin-retos',
    component: () => import('./views/VistaAdminRetos.vue')
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