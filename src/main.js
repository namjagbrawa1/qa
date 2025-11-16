import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'
import { useExamStore } from './stores/exam'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 初始化数据
const examStore = useExamStore()
examStore.initializeData().catch(console.error)

app.mount('#app')