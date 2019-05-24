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

    notifier: {
        dingding: {
            webhook: 'https://oapi.dingtalk.com/robot/send?access_token=bd4eade',
            mobiles: ['']
        }
    },

    messagePoolAliveCheckInterval: 1000 * 40,

    kilne: {
        open: false,
        reqInterval: 1000 * 30
    }
}