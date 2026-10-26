import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'
import './components/sammy.js' // registra <sammy-mascota> (la mascota animada)

const app = createApp(App)
app.use(router)
app.mount('#app')