import { initDb } from './index';

initDb()
    .then(() => {
        console.log('DB Init Complete');
        process.exit(0);
    })
    .catch((err) => {
        console.error('DB Init Failed', err);
        process.exit(1);
    });
