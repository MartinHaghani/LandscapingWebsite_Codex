import dotenv from 'dotenv';
import { createServer } from './server.js';

dotenv.config();

const { server, port } = createServer();

server.listen(port, () => {
  console.log(`Autoscape API running on http://localhost:${port}`);
});
