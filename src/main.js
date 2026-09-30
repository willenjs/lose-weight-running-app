import { mount } from 'svelte';
import './app.css';
import App from './ui/App.svelte';
import { init, appReady } from './ui/controller.svelte.js';

init();
mount(App, { target: document.getElementById('app') });
appReady();
