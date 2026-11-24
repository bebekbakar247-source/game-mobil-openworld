import './style.css';
import { Game } from './core/Game';

const container = document.getElementById('app');
if (!container) {
  throw new Error('Missing #app root element');
}

const game = new Game(container);
game.start();
