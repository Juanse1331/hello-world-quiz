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
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router