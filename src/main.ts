import { Game } from './game/Game';

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  requestAnimationFrame((timestamp) => game.loop(timestamp));
});
