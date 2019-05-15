module.exports = {
    awsParams: {
        //optional
        key: '', 
        //optional
        id: ''
    },

    db: {
        type: 'mysql',
        database: 'db_name',
        username: 'username',
        password: 'password',
        //optional. if sqlite must config
        storage: ''
    },

    log: {
        file: {
            name: './logs/quant.log' 
        }
    },

    messagePoolAliveCheckInterval: 1000 * 40,

    klineReqInterval: 1000 * 30
}