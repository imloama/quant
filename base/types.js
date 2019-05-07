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
    }
}, {
    //eslint-disable-next-line
    indexes: [{
        unique: true,
        fields: ['order-id']
    }
]
})

const init = function init () {
    Orders.sync({
        force: false
    })

}

module.exports = {
    sequelize,
    Orders,
    init
}