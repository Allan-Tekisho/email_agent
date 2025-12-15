import { initDb } from './index';

initDb().then(() => {
    console.log('DB Init Script Finished');
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
