import './style.css';
import { GameEngine } from './game/GameEngine.js';

const app = document.querySelector('#app');
const engine = new GameEngine(app);
engine.start();

// Expose engine instance for debugging or console access
window.__URBAN_MOTOR_ENGINE__ = engine;
