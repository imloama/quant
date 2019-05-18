/*eslint-disable*/

import Sequelize from 'sequelize'
import {
    db
} from '../config'

const sequelize = new Sequelize(db.database, db.username, db.password, {
    dialect: db.type,
    operatorsAliases: false,
    logging: false,

    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    },

    // 仅限 SQLite
    storage: db.storage
});

// const Fields = {
//     Orders: {
//         ID: 'id',

//         SeqID: 'seq-id',
//         Symbol: 'symbol',
//         AccountID: 'account-id',

//         OrderID: 'order-id',
//         OrderAmount: 'order-amount',
//         OrderPrice: 'order-price',
//         OrderType: 'order-type',
//         OrderSource: 'order-source',
//         OrderState: 'order-state',

//         CreatedAt: 'created-at',
//         FinishedAt: 'finished-at',

//         Role: 'role',
//         Price: 'price',

//         FilledAmount: 'filled-amount',
//         UnfilledAmount: 'unfilled-amount',
//         FilledCashAmount: 'filled-cash-amount',
//         FilledFees: 'filled-fees',

//         TaskID: 'task-id'
//     }
// }

const Orders = sequelize.define('order', {
    id: {
        type: Sequelize.INTEGER(11),
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
    },
    'order-id': {
        type: Sequelize.BIGINT
    },

    'seq-id': {
        type: Sequelize.BIGINT
    },
    'symbol': {
        type: Sequelize.STRING
    },

    'account-id': {
        type: Sequelize.BIGINT
    },

    'order-amount': {
        type: Sequelize.STRING
    },
    'order-price': {
        type: Sequelize.STRING
    },
    'created-at': {
        type: Sequelize.BIGINT
    },
    'finished-at': {
        type: Sequelize.BIGINT
    },
    'order-type': {
        type: Sequelize.STRING
    },

    'order-source': {
        type: Sequelize.STRING
    },
    'order-state': {
        type: Sequelize.STRING
    },

    'role': {
        type: Sequelize.STRING
    },

    'price': {
        type: Sequelize.STRING
    },

    'filled-amount': {
        type: Sequelize.STRING
    },

    'unfilled-amount': {
        type: Sequelize.STRING
    },

    'filled-cash-amount': {
        type: Sequelize.STRING
    },

    'filled-fees': {
        type: Sequelize.STRING
    },
    'task-id': {
        type: Sequelize.BIGINT
    }
}, {
    indexes: [{
        unique: true,
        fields: ['order-id']
    }, {
        fields: ['task-id']
    }]
})

const Kline = sequelize.define('kline', {
    'symbol': {
        type: Sequelize.STRING
    },
    'period': {
        type: Sequelize.STRING
    },
    'amount': {
        type: Sequelize.DECIMAL(30, 8)
    },
    'count': {
        type: Sequelize.INTEGER
    },
    'ts': {
        type: Sequelize.INTEGER
    },
    'open': {
        type: Sequelize.DECIMAL(30, 8)
    },

    'close': {
        type: Sequelize.DECIMAL(30, 8)
    },

    'low': {
        type: Sequelize.DECIMAL(30, 8)
    },

    'high': {
        type: Sequelize.DECIMAL(30, 8)
    },

    'vol': {
        type: Sequelize.DECIMAL(30, 8)
    }

}, {
    indexes: [{

            fields: ['symbol', 'period']
        },
        {
            unique: true,
            fields: ['symbol', 'period', 'ts']
        }
    ]
})

const Tasks = sequelize.define('task', {
    'symbol': {
        type: Sequelize.STRING
    },
    'start-price': {
        type: Sequelize.STRING
    },
    'end-price': {
        type: Sequelize.STRING
    },
    'grid-rate': {
        type: Sequelize.STRING

    },
    'grid-count': {
        type: Sequelize.STRING

    },
    'grid-amount': {
        type: Sequelize.STRING
    },
    'grid-prices': {
        type: Sequelize.STRING(1024)
    },
    'state': {
        type: Sequelize.TINYINT //0 invalid 1 normal
    }
})

const init = function init() {
    Orders.sync({
        // alert: true,
        force: false
    })

    Kline.sync({

        force: false
    })

    Tasks.sync({
        force: false
    })

}

export {
    sequelize,
    Orders,
    Kline,
    Tasks,
    init
}