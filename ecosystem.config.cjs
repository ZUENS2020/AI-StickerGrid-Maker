module.exports = {
    apps: [
        {
            name: 'stickergrid-maker',
            script: 'server/index.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production',
                PORT: 5001
            }
        }
    ]
};
