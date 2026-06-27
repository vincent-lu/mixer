import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faPlay,
  faPause,
  faStop,
  faTrash,
  faFolder,
  faFolderMusic,
  faFolderOpen,
  faMusic,
  faFilm,
  faGear,
  faCircleCheck,
  faCircleXmark,
  faSpinner,
  faPlus,
  faLayerGroup,
} from '@fortawesome/sharp-regular-svg-icons'
import App from './App.vue'
import './assets/main.css'

library.add(
  faPlay,
  faPause,
  faStop,
  faTrash,
  faFolder,
  faFolderMusic,
  faFolderOpen,
  faMusic,
  faFilm,
  faGear,
  faCircleCheck,
  faCircleXmark,
  faSpinner,
  faPlus,
  faLayerGroup,
)

const app = createApp(App)
app.component('FaIcon', FontAwesomeIcon)
app.use(createPinia())
app.mount('#app')
